import PropTypes from "prop-types";
import React from "react";
import {
  useGlobalConfig,
  Box,
  Button,
  FieldPickerSynced,
  FormField,
  Heading,
  Switch,
  TablePickerSynced,
  Text,
  Input,
  Link,
  SelectButtons,
} from "@airtable/blocks/ui";

import {
  useSettings,
  ConfigKeys,
  allowedUrlFieldTypes,
  allowedPrototypeUrlFieldTypes,
} from "./settings";

function SettingsForm({ setIsSettingsOpen }) {
  const globalConfig = useGlobalConfig();
  const {
    isValid,
    message,
    settings: {
      isEnforced,
      urlTable,
      isCustomApi,
      customApiUrl,
      customBlobStore,
      restrictMode,
    },
  } = useSettings();

  return (
    <Box
      position="absolute"
      top={0}
      bottom={0}
      left={0}
      right={0}
      display="flex"
      flexDirection="column"
    >
      <Box flex="auto" padding={4} paddingBottom={2}>
        <Heading marginBottom={3}>Settings</Heading>
        <FormField label="">
          <Switch
            aria-label="Enable this to provide your own implementation of Sketch2Code API."
            value={isCustomApi}
            onChange={(value) => {
              globalConfig.setAsync(ConfigKeys.IS_CUSTOM_API, value);
            }}
            label="Use a specific field for UI sketches"
          />
          <Text paddingY={1} textColor="light">
            {isCustomApi
              ? "The block will show HTML UI output for the selected record in grid view if the table has attachment(s) containing UI Sketch(es) in the specified field"
              : "The block will show HTML UI Output if the selected cell in grid view is an attachment field type containing UI Sketch(es)"}
          </Text>
        </FormField>
        {isCustomApi && (
          <>
            <FormField label="S2C Web API Base URI">
              <Input
                type="url"
                value={customApiUrl}
                onChange={(e) =>
                  globalConfig.setAsync(
                    ConfigKeys.CUSTOM_WEB_API,
                    e.target.value
                  )
                }
              />
              <Text paddingY={1} textColor="light">
                You can set up and give the URI of your own implementation of
                Sketch2Code Web API by following the{" "}
                <Link
                  href="https://github.com/microsoft/ailab/tree/master/Sketch2Code"
                  target="_blank"
                >
                  docs
                </Link>
              </Text>
            </FormField>
            <FormField label="S2C Blog storage URI">
              <Input
                type="url"
                value={customBlobStore}
                onChange={(e) =>
                  globalConfig.setAsync(
                    ConfigKeys.CUSTOM_BLOB_STORE,
                    e.target.value
                  )
                }
              />
              <Text paddingY={1} textColor="light">
                Provide the URL of the Azure Blob storage
              </Text>
            </FormField>
          </>
        )}
        <FormField label="">
          <Switch
            aria-label="When enabled, the block will only show HTML UI output for the specified table and field, regardless of what field is selected."
            value={isEnforced}
            onChange={(value) => {
              globalConfig.setAsync(ConfigKeys.IS_ENFORCED, value);
            }}
            label="Use a specific field for UI sketches"
          />
          <Text paddingY={1} textColor="light">
            {isEnforced
              ? "The block will show HTML UI output for the selected record in grid view if the table has attachment(s) containing UI Sketch(es) in the specified field"
              : "The block will show HTML UI Output if the selected cell in grid view is an attachment field type containing UI Sketch(es)"}
          </Text>
        </FormField>
        {isEnforced && (
          <FormField label="S2C table">
            <TablePickerSynced globalConfigKey={ConfigKeys.URL_TABLE_ID} />
          </FormField>
        )}
        {isEnforced && urlTable && (
          <>
            <FormField label="Sketches field">
              <FieldPickerSynced
                table={urlTable}
                globalConfigKey={ConfigKeys.URL_FIELD_ID}
                allowedTypes={allowedUrlFieldTypes}
              />
            </FormField>
            <FormField label="Prototype URLs field">
              <FieldPickerSynced
                table={urlTable}
                globalConfigKey={ConfigKeys.PROTOTYPE_URL_FIELD}
                allowedTypes={allowedPrototypeUrlFieldTypes}
              />
              <Text paddingY={1} textColor="light">
                Choose a field for storing prototype URLs
              </Text>
            </FormField>
            <FormField label="Enable Only Mode">
                <SelectButtons
                  value={restrictMode}
                  onChange={(value) => globalConfig.setAsync(ConfigKeys.RESTRICT_MODE, value)}
                  options={[
                    { value: "sketch", label: "Sketch" },
                    { value: "code", label: "Code" },
                    { value: "both", label: "Both"}
                  ]}
                  width="100%"
                />
            </FormField>
          </>
        )}
      </Box>
      <Box display="flex" flex="none" padding={3} borderTop="thick">
        <Box
          flex="auto"
          display="flex"
          alignItems="center"
          justifyContent="flex-end"
          paddingRight={2}
        >
          <Text textColor="light">{message}</Text>
        </Box>
        <Button
          disabled={!isValid}
          size="large"
          variant="primary"
          onClick={() => setIsSettingsOpen(false)}
        >
          Done
        </Button>
      </Box>
    </Box>
  );
}

SettingsForm.propTypes = {
  setIsSettingsOpen: PropTypes.func.isRequired,
};

export default SettingsForm;
