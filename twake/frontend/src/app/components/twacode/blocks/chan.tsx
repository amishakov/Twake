import React from 'react';
import Collections from 'app/deprecated/CollectionsV1/Collections/Collections';
import Emojione from 'components/emojione/emojione';
import ChannelsService from 'app/deprecated/channels/channels';

type PropsType = {
  // channel id
  id: string;
  // channel name
  name: string;
};

export default (props: PropsType): JSX.Element => {
  const channel = Collections.get('channels').find(props.id);

  if (!props.id || !channel) {
    return <span>#{props.name}</span>;
  }

  return (
    <div className="channel_twacode" onClick={() => ChannelsService.select(channel)}>
      <Emojione type={channel.icon} />
      {channel.name}
    </div>
  );
};
