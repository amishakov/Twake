import { CharacterMetadata, ContentBlock, ContentState, EditorState, Modifier } from 'draft-js';
import { getSelectedBlock } from 'draftjs-utils';
import { Mention } from './mention';
import MentionSuggestion from './mention-suggestion';
import { EditorSuggestionPlugin, SelectOrInsertOptions } from '../';
import AccessRightsService from 'app/features/workspace-members/services/workspace-members-access-rights-service';
import WorkspaceService from 'app/deprecated/workspaces/workspaces';
import Collections from 'app/deprecated/CollectionsReact/Collections';
import DepreciatedCollections from 'app/deprecated/CollectionsV1/Collections/Collections';
import { getChannelMembers } from 'app/deprecated/channels/ChannelCollectionPath';
import { UserType } from 'app/features/users/types/user';
import { ChannelMemberResource } from 'app/features/channels/types/channel';
import UserService from 'app/features/users/services/current-user-service';
import RouterService from 'app/features/router/services/router-service';
import UserAPIClient from 'app/features/users/api/user-api-client';
import { WorkspaceUserType } from 'app/features/workspaces/types/workspace';
import Strings from 'app/features/global/utils/strings';

import './style.scss';

export const MENTION_TYPE = 'MENTION';
const MENTION_CHAR = '@';

export type MentionSuggestionType = {
  username: string;
};

const findMentionEntities = (
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void,
  contentState: ContentState,
) => {
  contentBlock.findEntityRanges((character: CharacterMetadata) => {
    const entityKey = character.getEntity();
    return entityKey !== null && contentState.getEntity(entityKey).getType() === MENTION_TYPE;
  }, callback);
};

const resolver = (
  text: string,
  max: number,
  callback: (mentions: MentionSuggestionType[]) => void,
) => {
  const result: Array<MentionSuggestionType & { autocomplete_id: number }> = [];
  const { companyId, workspaceId, channelId } = RouterService.getStateFromRoute();

  if (AccessRightsService.getCompanyLevel(WorkspaceService.currentGroupId) === 'guest') {
    // user is guest, lookup for channel members only
    const channelMembersCollection = Collections.get(
      getChannelMembers(companyId, workspaceId, channelId),
      ChannelMemberResource,
    );
    const users = channelMembersCollection
      .find({})
      .map(member => DepreciatedCollections.get('users').find(member.id))
      .filter(
        (user: UserType) =>
          `${user.username} ${user.first_name} ${user.last_name} ${user.email}`
            .toLocaleLowerCase()
            .indexOf(text.toLocaleLowerCase()) >= 0,
      );

    for (let j = 0; j < Math.min(max, users.length); j++) {
      result[j] = { ...users[j], ...{ autocomplete_id: j } };
    }

    callback(result);
  } else {
    UserAPIClient.search<WorkspaceUserType>(
      Strings.removeAccents(text),
      {
        scope: 'workspace',
        companyId,
        workspaceId,
      },
      wsUsers => {
        const users = wsUsers.map(wsUser => wsUser.user);

        for (let j = 0; j < Math.min(max, users.length); j++) {
          result[j] = { ...users[j], ...{ autocomplete_id: j } };
        }

        callback(result);
      },
    );
  }
};

const addMention = (
  mention: MentionSuggestionType,
  editorState: EditorState,
  options: SelectOrInsertOptions,
): EditorState => {
  let spaceAlreadyPresent = false;
  const username = UserService.getFullName(mention);
  const mentionText = `${MENTION_CHAR}${username}`;
  const entityKey = editorState
    .getCurrentContent()
    .createEntity(MENTION_TYPE, 'IMMUTABLE', mention)
    .getLastCreatedEntityKey();
  const selectedBlock = getSelectedBlock(editorState);
  const selectedBlockText = selectedBlock.getText();
  let focusOffset = editorState.getSelection().getFocusOffset();
  const mentionIndex = (selectedBlockText.lastIndexOf(` ${MENTION_CHAR}`, focusOffset) || 0) + 1;

  if (selectedBlockText.length === mentionIndex + 1) {
    focusOffset = selectedBlockText.length;
  }

  if (selectedBlockText[focusOffset] === ' ') {
    spaceAlreadyPresent = true;
  }

  let updatedSelection = editorState.getSelection().merge({
    anchorOffset: mentionIndex,
    focusOffset,
  });
  let newEditorState = EditorState.acceptSelection(editorState, updatedSelection);
  let contentState = Modifier.replaceText(
    newEditorState.getCurrentContent(),
    updatedSelection,
    mentionText,
    newEditorState.getCurrentInlineStyle(),
    entityKey,
  );

  newEditorState = EditorState.push(newEditorState, contentState, 'insert-characters');

  if (!spaceAlreadyPresent && options.addSpaceAfter) {
    // insert a blank space after mention
    updatedSelection = newEditorState.getSelection().merge({
      anchorOffset: mentionIndex + mentionText.length,
      focusOffset: mentionIndex + mentionText.length,
    });
    newEditorState = EditorState.acceptSelection(newEditorState, updatedSelection);
    contentState = Modifier.insertText(
      newEditorState.getCurrentContent(),
      updatedSelection,
      ' ',
      newEditorState.getCurrentInlineStyle(),
      undefined,
    );
  }

  return EditorState.push(newEditorState, contentState, 'insert-characters');
};

export default (
  options: { maxSuggestions: number } = { maxSuggestions: 10 },
): EditorSuggestionPlugin<MentionSuggestionType> => ({
  resolver: (text, callback) => resolver(text, options.maxSuggestions, callback),
  decorator: {
    strategy: findMentionEntities,
    component: Mention,
  },
  trigger: /\B@([^\B]+)$/,
  resourceType: MENTION_TYPE,
  getTextDisplay: (mention: MentionSuggestionType) => mention.username,
  onSelected: (
    mention: MentionSuggestionType,
    editorState: EditorState,
    options: SelectOrInsertOptions = { addSpaceAfter: true },
  ) => addMention(mention, editorState, options),
  renderSuggestion: (mention: MentionSuggestionType) => MentionSuggestion(mention),
  serializer: {
    // When in code-block, we choose to not handle the mention the same way: It will be only a text, not a mention
    // this is why we have the <MENTION> and <CODE_MENTION> elements
    replace: content =>
      content
        .replace(/<MENTION\|(.*?)>(.*?)<\/MENTION>/gm, (_match, mention) => mention)
        .replace(
          /<CODE_MENTION\|(.*?)>(.*?)<\/CODE_MENTION>/gm,
          (_match, mention, fullName) => fullName,
        ),
    open: (entity, block) =>
      block?.type === 'code-block'
        ? `<CODE_${MENTION_TYPE}|@${(entity as any).data.username}>`
        : `<${MENTION_TYPE}|@${(entity as any).data.username}>`,
    close: (_entity, block) =>
      block?.type === 'code-block' ? `</CODE_${MENTION_TYPE}>` : `</${MENTION_TYPE}>`,
  },
  returnFullTextForSuggestion: true,
  // will skip suggestion when already in a MENTION block
  skipSuggestionForTypes: [MENTION_TYPE],
});
