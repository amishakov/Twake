import { useEffect } from 'react';
import UserAPIClient from 'app/features/users/api/user-api-client';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';
import useRouterCompany from 'app/features/router/hooks/use-router-company';
import useRouterWorkspace from 'app/features/router/hooks/use-router-workspace';

export const useSetLastWorkspacePreference = () => {
  const companyId = useRouterCompany();
  const workspaceId = useRouterWorkspace();
  const { user } = useCurrentUser();

  useEffect(() => {
    UserAPIClient.setUserPreferences({
      recent_workspaces: [{ workspace_id: workspaceId, company_id: companyId }],
    });
  }, [workspaceId, companyId]);
};
