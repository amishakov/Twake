import DepreciatedCollections from 'app/deprecated/CollectionsV1/Collections/Collections.js';
import WorkspacesApps from 'app/deprecated/workspaces/workspaces_apps.js';
import { Message } from '../types/message';
import userAsyncGet from 'app/features/users/utils/async-get';
import { getCompanyApplication as getApplication } from 'app/features/applications/state/company-applications';

export const getSender = (message: Message | undefined) => {
  var senderData: any = {
    type: 'unknown',
  };

  if (message) {
    if (message.sender) {
      senderData = DepreciatedCollections.get('users').find(message.sender, () => {
        if (message.sender) {
          userAsyncGet(message.sender);
        }
      });

      if (!senderData) {
        senderData = {
          type: 'user',
          id: message.sender,
        };
      } else {
        senderData = { ...senderData };
        senderData.type = 'user';
      }
    }

    if (message.message_type === 1) {
      //App message
      var app = getApplication(message.application_id || '');
      if (!app?.id) {
        app = getApplication(message.application_id || '');
      }

      if (app?.id) {
        senderData = {
          type: 'app',
          application: app,
          username: 'app#' + app?.identity?.code,
          first_name: app.identity?.icon,
          last_name: '',
          thumbnail: WorkspacesApps.getAppIcon(app),
        };
      }
    }
  }

  return senderData;
};
