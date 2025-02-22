import React from 'react';
import { Typography, Alert } from 'antd';
import Languages from 'app/features/global/services/languages-service';
import InitService from 'app/features/global/services/init-service';
import { AlertTriangle } from 'react-feather';
import { useCurrentCompany } from 'app/features/companies/hooks/use-companies';
import { CompanyLimitsEnum, CompanyType } from 'app/features/companies/types/company';

type PropsType = { company: Partial<CompanyType>; magicLink?: boolean };

const { Text, Link } = Typography;
const LockedInviteAlert = (props: PropsType): JSX.Element => {
  const limit = props?.company?.plan?.limits?.[CompanyLimitsEnum.COMPANY_MEMBERS_LIMIT] || 0;
  const onClickBtn = () =>
    window.open(
      InitService.server_infos?.configuration?.accounts?.console?.company_subscription_url || '',
      'blank',
    );

  return (
    <Alert
      type="warning"
      message=""
      style={{
        background: 'transparent',
        borderColor: 'var(--warning)',
        padding: 8,
      }}
      description={
        <>
          <AlertTriangle color="var(--warning)" size={16} className="small-right-margin" />
          <Text>
            {Languages.t(
              'components.locked_features_components.locked_invite_alert.message_part_1',
              [limit],
            )}
            {props.magicLink ? (
              <>
                {Languages.t(
                  'components.locked_features_components.locked_invite_alert.message_magic_link',
                )}
              </>
            ) : (
              <>
                <Link onClick={onClickBtn}>
                  {Languages.t(
                    'components.locked_features_components.locked_invite_alert.message_link',
                  )}
                </Link>
                {Languages.t(
                  'components.locked_features_components.locked_invite_alert.message_part_2',
                )}
              </>
            )}
          </Text>
        </>
      }
    />
  );
};

export default LockedInviteAlert;
