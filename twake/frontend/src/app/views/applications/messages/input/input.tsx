import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { Send } from 'react-feather';
import { EditorState } from 'draft-js';
import { Tooltip } from 'antd';

import InputOptions from './parts/InputOptions';
import EphemeralMessages from './parts/EphemeralMessages';
import MessageEditorsManager from 'app/features/messages/services/message-editor-service-factory';
import MessagesService from 'app/features/messages/services/messages-service';
import PendingAttachments from './parts/PendingAttachments';
import RichTextEditorStateService from 'app/components/rich-text-editor/editor-state-service';
import { EditorView } from 'app/components/rich-text-editor';
import Languages from 'app/features/global/services/languages-service';
import { TextCount, TextCountService } from 'app/components/rich-text-editor/text-count/';
import UploadZone from 'app/components/uploads/upload-zone';
import Workspaces from 'app/deprecated/workspaces/workspaces';
import { FileType } from 'app/features/files/types/file';
import { useUploadZones } from 'app/features/files/hooks/use-upload-zones';
import { useMessageEditor } from 'app/features/messages/hooks/use-message-editor';
import useRouterCompany from 'app/features/router/hooks/use-router-company';
import { delayRequest } from 'app/features/global/utils/managedSearchRequest';
import { useChannel } from 'app/features/channels/hooks/use-channel';
import {
  useChannelWritingActivityEmit,
  useWritingDetector,
} from 'app/features/channels/hooks/use-channel-writing-activity';
import { getCompanyApplications } from 'app/features/applications/state/company-applications';
import AlertManager from 'app/features/global/services/alert-manager-service';
import WorkspacesApps from 'app/deprecated/workspaces/workspaces_apps.js';
import { useMessage } from 'app/features/messages/hooks/use-message';

import './input.scss';

type Props = {
  messageId?: string;
  channelId?: string;
  threadId: string;
  collectionKey?: string;
  onResize?: (evt: any) => void;
  onEscape?: (evt: any) => void;
  onFocus?: () => void;
  ref?: (node: any) => void;
  onSend?: (text: string) => void;
  onChange?: (editorState: EditorState) => void;
  triggerApp?: (app: any, from_icon: any, evt: any) => void;
  localStorageIdentifier?: string;
  disableApps?: boolean;
  context?: string; //Main input or response input (empty string)
  format?: 'markdown' | 'raw';
  editorPlugins?: Array<string>;
  editorState?: EditorState;
};

export default (props: Props) => {
  const { channel } = useChannel(props.channelId || '');
  const companyId = useRouterCompany();

  const {
    editor,
    setValue,
    setFiles,
    send,
    key: editorId,
  } = useMessageEditor({
    companyId,
    workspaceId: channel.workspace_id || '',
    channelId: props.channelId,
    threadId: props.threadId,
    messageId: props.messageId,
  });

  const { message: parentMessage } = useMessage({
    companyId,
    threadId: props.threadId,
    id: props.threadId,
  });

  const { upload, clear: clearUploads } = useUploadZones(editorId);
  const format = props.format || 'markdown';
  const editorRef = useRef<EditorView>(null);
  const submitRef = useRef<HTMLDivElement>(null);
  const [hasEphemeralMessage, setHasEphemeralMessage] = useState(false);
  const messageEditorService = MessageEditorsManager.get(props.channelId || '');

  const editorPlugins = props.editorPlugins || ['emoji', 'mention', 'channel', 'command'];
  const [editorState, setEditorState] = useState(() =>
    RichTextEditorStateService.get(editorId, { plugins: editorPlugins }),
  );
  const [isTooLong, setTooLong] = useState(false);

  const { iAmWriting } = useChannelWritingActivityEmit(props.channelId || '', props.threadId);

  const { onKeydown: onKeydownRealtimeListener } = useWritingDetector();

  useEffect(() => {
    setTooLong(TextCountService.getStats(editorState).isTooLong);
  }, [editorState]);

  useEffect(() => {
    focusEditor();
    (async () => {
      if (editor.value && editor.value.length) {
        setEditorState(
          RichTextEditorStateService.get(editorId, {
            plugins: editorPlugins,
            clearIfExists: true,
            initialContent: RichTextEditorStateService.getDataParser(editorPlugins).fromString(
              editor.value,
              format,
            ),
          }),
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disable_app: any = {};

  useEffect(() => {
    if (props.editorState && props.editorState !== editorState) {
      setEditorState(props.editorState);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editorState]);

  const getContentOutput = (editorState: EditorState) => {
    return RichTextEditorStateService.getDataParser(editorPlugins).toString(editorState, format);
  };

  const onSend = async () => {
    const content = getContentOutput(editorState);
    setValue(content);

    if (props.onSend) {
      props.onSend(content);
      return;
    }

    //Sending commands
    if (content.indexOf('/') === 0 && !props.messageId) {
      let app: any = null;
      let app_name = content.split(' ')[0].slice(1);
      // eslint-disable-next-line array-callback-return
      getCompanyApplications(companyId).map((_app: any) => {
        if (_app?.identity?.code === app_name) {
          app = _app;
        }
      });

      if (!app) {
        AlertManager.alert(() => {}, {
          text: Languages.t('services.apps.messages.no_command_possible', [content, app_name]),
          title: Languages.t('services.apps.messages.no_app'),
        });
        return;
      }
      let data = {
        command: content.split(' ').slice(1).join(' '),
        channel: channel,
        parent_message: parentMessage || null,
      };

      WorkspacesApps.notifyApp(app.id, 'action', 'command', data);

      return;
    }

    if (content || editor.files.length > 0) {
      setEditorState(RichTextEditorStateService.clear(editorId).get(editorId));
      clearUploads();
      await send();
    }
  };

  const triggerApp = (app: any, from_icon: any, evt: any) => {
    if (disable_app[app.id] && new Date().getTime() - disable_app[app.id] < 1000) {
      return;
    }
    disable_app[app.id] = new Date().getTime();
    MessagesService.triggerApp(channel, props.threadId, app, from_icon, evt);
  };

  const focus = () => {
    messageEditorService.openEditor(props.threadId || '', props.messageId || '', props.context);
  };

  const focusEditor = () => {
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const setRichTextEditorState = (editorState: EditorState): void => {
    setEditorState(editorState);
    RichTextEditorStateService.set(editorId, editorState);
  };

  const isEmpty = (): boolean => {
    return (
      editorState.getCurrentContent().getPlainText().trim().length === 0 && !editor.files.length
    );
  };

  const onUpArrow = (e: any): void => {
    if (isEmpty()) {
      MessagesService.startEditingLastMessage({
        channel_id: props.channelId,
        parent_message_id: props.threadId,
      });
    }
  };

  const onChange = async (newEditorState: EditorState) => {
    const statsAfter = TextCountService.getStats(newEditorState);
    const statsBefore = TextCountService.getStats(editorState);
    if (statsAfter.length > statsBefore.length)
      onKeydownRealtimeListener(state => iAmWriting(state));

    //Delay request make the input faster (getContentOutput is a heavy call)
    delayRequest(`editor-${editorId}`, () => {
      setValue(getContentOutput(newEditorState));
    });

    if (props.onChange) {
      props.onChange(newEditorState);
      return;
    }
    setRichTextEditorState(newEditorState);
  };

  const isEditing = (): boolean => {
    return !!(props.messageId && props.messageId === messageEditorService.currentEditorMessageId);
  };

  const setUploadZoneRef = (node: UploadZone): void =>
    messageEditorService.setUploadZone(props.messageId || props.threadId || '', node);

  const onUploaded = (file: FileType) =>
    messageEditorService.onAddAttachment(props.messageId || props.threadId, file);

  const onDragEnter = (): void => {
    messageEditorService.getUploadZone(props.threadId);
  };

  const getFilesLimit = () => {
    const attachements = messageEditorService.getAttachements(editorId) || [];
    const limit = messageEditorService.ATTACHEMENTS_LIMIT;

    return attachements.length ? limit - attachements.length : limit;
  };

  const onAddFiles = async (files: File[]) => {
    await upload(files);
  };

  const onFilePaste = (blobs: Blob[]) => {
    if (blobs.length > 0) {
      const file = new File(
        [blobs[0]],
        'pasted_' +
          new Date()
            .toISOString()
            .replaceAll(/(Z|\.[0-9]+)/gm, '')
            .replace(/T/, '_') +
          '.png',
        {
          type: 'image/png',
        },
      );
      upload([file]);
    }
  };

  const disabled = isEmpty() || isTooLong;
  return (
    <div className={'message-input'} ref={props.ref} onClick={() => focus()}>
      <UploadZone
        className="upload-zone-centerer"
        ref={setUploadZoneRef}
        disableClick
        parent={''}
        driveCollectionKey={props.collectionKey}
        uploadOptions={{ workspace_id: Workspaces.currentWorkspaceId, detached: true }}
        onUploaded={onUploaded}
        onDragEnter={onDragEnter}
        multiple={true}
        allowPaste={true}
        filesLimit={getFilesLimit()}
        onAddFiles={onAddFiles}
      >
        <EphemeralMessages
          channelId={props.channelId || ''}
          workspaceId={channel.workspace_id || ''}
          threadId={props.threadId}
          onHasEphemeralMessage={() => {
            if (!hasEphemeralMessage) {
              setHasEphemeralMessage(true);
            }
          }}
          onNotEphemeralMessage={() => {
            if (hasEphemeralMessage) {
              setHasEphemeralMessage(false);
            }
          }}
        />

        <PendingAttachments
          zoneId={editorId}
          initialValue={editor.files || []}
          onChange={list => setFiles(list)}
        />

        {!hasEphemeralMessage && (
          <div className="editorview-submit">
            <EditorView
              ref={editorRef}
              onChange={editorState => {
                onChange(editorState);
              }}
              clearOnSubmit={true}
              outputFormat={format}
              plugins={editorPlugins}
              editorState={editorState}
              onSubmit={() => onSend()}
              onUpArrow={e => onUpArrow(e)}
              onFilePaste={onFilePaste}
              placeholder={Languages.t('scenes.apps.messages.input.placeholder')}
            />
            {!isEditing() && (
              <Tooltip
                title={Languages.t('scenes.apps.messages.input.send_message')}
                placement="top"
              >
                <div
                  ref={submitRef}
                  className={classNames('submit-button', {
                    disabled: disabled,
                    skew_in_right: !disabled,
                  })}
                  onClick={() => {
                    if (!isEmpty() && !isTooLong) {
                      onSend();
                    }
                  }}
                >
                  <Send className="send-icon" size={20} />
                </div>
              </Tooltip>
            )}
          </div>
        )}

        <div className="counter-right">
          <TextCount editorState={editorState} displayOnlyAfterThresold={true} />
        </div>

        {!hasEphemeralMessage && !props.messageId && (
          <InputOptions
            isEmpty={isEmpty()}
            channelId={props.channelId || ''}
            threadId={props.threadId}
            onSend={() => onSend()}
            triggerApp={(app, fromIcon, evt) => triggerApp(app, fromIcon, evt)}
            onAddEmoji={emoji => editorRef.current?.insertCommand('EMOJI', emoji)}
            richTextEditorState={editorState}
            onRichTextChange={editorState => setRichTextEditorState(editorState)}
          />
        )}
      </UploadZone>
    </div>
  );
};
