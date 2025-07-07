import React from 'react';
import { Plugin } from '../hooks/usePlugins';
import { useTranslations } from '../hooks/useTranslations';

interface PluginDetailsProps {
  selectedPlugin: Plugin | null;
  locale?: 'en' | 'ru';
}

export const PluginDetails: React.FC<PluginDetailsProps> = ({ 
  selectedPlugin, 
  locale = 'en' 
}) => {
  const { t } = useTranslations(locale);

  return (
    <div className="plugin-details">
      <h2>{t('options.plugins.details.title')}</h2>
      {selectedPlugin ? (
        <div className="plugin-details-content">
          <h3>{selectedPlugin.name}</h3>
          <p><strong>{t('options.plugins.details.version')}:</strong> {selectedPlugin.version}</p>
          <p><strong>{t('options.plugins.details.description')}:</strong> {selectedPlugin.description}</p>
          {selectedPlugin.manifest && (
            <>
              <p><strong>{t('options.plugins.details.mainServer')}:</strong> {selectedPlugin.manifest.main_server}</p>
              {selectedPlugin.manifest.host_permissions && (
                <div>
                  <strong>{t('options.plugins.details.hostPermissions')}:</strong>
                  <ul>
                    {selectedPlugin.manifest.host_permissions.map((perm: string, index: number) => (
                      <li key={index}>{perm}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPlugin.manifest.permissions && (
                <div>
                  <strong>{t('options.plugins.details.permissions')}:</strong>
                  <ul>
                    {selectedPlugin.manifest.permissions.map((perm: string, index: number) => (
                      <li key={index}>{perm}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <p>{t('options.plugins.details.selectPlugin')}</p>
      )}
    </div>
  );
}; 