import React, { useEffect, useState } from 'react';
import UsersService from 'app/features/users/services/current-user-service';
import userAsyncGet from 'app/features/users/utils/async-get';
import MenuManager from 'app/components/menus/menus-manager';
import UserCard from 'app/components/user-card/user-card';
import ChannelsService from 'app/deprecated/channels/channels';
import Languages from 'app/features/global/services/languages-service';

import '../message.scss';
import { Typography } from 'antd';
type PropsType = {
  userId: string;
};

export default ({ userId }: PropsType) => {
  const [fullName, setFullName] = useState<string>('');

  const _setFullName = async () => {
    const user = await userAsyncGet(userId);
    if (user) setFullName(UsersService.getFullName(user));
    else setFullName('not found');
  };
  useEffect(() => {
    _setFullName();
  });

  let user_name_node: any = null;
  const displayUserCard = async () => {
    //@ts-ignore
    let box = window.getBoundingClientRect(user_name_node);
    const user = await userAsyncGet(userId);

    MenuManager.openMenu(
      [
        user && {
          type: 'react-element',
          reactElement: () => (
            <UserCard user={user} onClick={() => ChannelsService.openDiscussion([user.id])} />
          ),
        },
      ],
      box,
      null,
      { margin: 8 },
    );
  };

  const translateUsingReactNode = (key: string, replacements: any[]): any[] => {
    let temp = Languages.t(
      key,
      replacements.map((_, i) => `{${i}}`),
    );
    let list: any[] = [];
    replacements.forEach((replacement, i) => {
      let split = temp.split(`{${i}}`);
      list.push(
        <Typography.Text key={i} type="secondary">
          {split[0]}
        </Typography.Text>,
      );
      list.push(replacement);
      temp = split[1];
    });
    list.push(<Typography.Text type="secondary">{temp}</Typography.Text>);
    return list;
  };

  const clickableFullName = (
    <span
      ref={node => (user_name_node = node)}
      style={{
        fontWeight: 700,
        marginRight: 4,
        cursor: ' pointer',
      }}
      onClick={() => displayUserCard()}
    >
      {fullName}
    </span>
  );

  const isCurrentUser = UsersService.getCurrentUserId() === userId;
  return isCurrentUser ? (
    <>{Languages.t('scenes.apps.messages.message.parts.deleted_content.text.current_user')}</>
  ) : (
    <>
      {translateUsingReactNode('scenes.apps.messages.message.parts.deleted_content.text', [
        clickableFullName,
      ])}
    </>
  );
};
