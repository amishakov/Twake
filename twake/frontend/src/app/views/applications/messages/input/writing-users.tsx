import React, { Component } from 'react';

import Languages from 'app/features/global/services/languages-service';
import Collections from 'app/deprecated/CollectionsV1/Collections/Collections.js';
import UserService from 'app/features/users/services/current-user-service';
import MessagesService from 'app/features/messages/services/messages-service';

type Props = {
  channelId: string;
  threadId: string;
};

export default class WritingUsers extends Component<Props> {
  timeout: any = 0;
  savedState: string = '';

  constructor(props: Props) {
    super(props);

    Languages.addListener(this);
    Collections.get('messages').addListener(this, [], () => {
      const newState = JSON.stringify(
        MessagesService.getWritingUsers(this.props.channelId, this.props.threadId),
      );
      const savedState = this.savedState;
      this.savedState = newState;
      return newState !== savedState;
    });
    MessagesService.addListener(this);
  }
  componentWillUnmount() {
    Languages.removeListener(this);
    Collections.get('messages').removeListener(this);
    MessagesService.removeListener(this);
  }
  componentDidUpdate() {
    var writing_users = MessagesService.getWritingUsers(this.props.channelId, this.props.threadId);
    if (writing_users.length > 0) {
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        this.setState({});
      }, 5000);
    }
  }
  render() {
    var writing_users = MessagesService.getWritingUsers(this.props.channelId, this.props.threadId);

    if (writing_users.length === 0) {
      return '';
    }

    var phrase = Languages.t('scenes.apps.messages.messageslist.get_writing_users', []);
    if (writing_users.length === 1) {
      phrase = Languages.t('scenes.apps.messages.messageslist.get_writing_user');
    }

    return [
      <div className="writing_message">
        {writing_users
          .map((id: string) => {
            return UserService.getFullName(Collections.get('users').find(id));
          })
          .join(', ')}{' '}
        {phrase}
      </div>,
    ];
  }
}
