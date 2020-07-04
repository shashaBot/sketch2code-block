import { useBase, useGlobalConfig } from "@airtable/blocks/ui";
import { FieldType } from "@airtable/blocks/models";

export const ConfigKeys = {
  IS_ENFORCED: "isEnforced",
  URL_TABLE_ID: "urlTableId",
  URL_FIELD_ID: "urlFieldId",
  IS_CUSTOM_API: "isCustomApi",
  CUSTOM_WEB_API: "customApiUrl",
  CUSTOM_BLOB_STORE: "customBlobStore",
  PROTOTYPE_URL_FIELD: "prototypeUrlField",
  RESTRICT_MODE: "restrictMode",
};

export const allowedUrlFieldTypes = [FieldType.MULTIPLE_ATTACHMENTS];

export const allowedPrototypeUrlFieldTypes = [FieldType.URL, FieldType.BARCODE];

/**
 * Return settings from GlobalConfig with defaults, and converts them to Airtable objects.
 * @param {object} globalConfig
 * @param {Base} base - The base being used by the block in order to convert id's to objects
 * @returns {{
 *     isEnforced: true | false,
 *     urlTable: Table | null,
 *     urlField: Field | null,
 *     isCustomApi: true | false,
 *     customApiUrl: string,
 *     customBlobStore: string,
 *     prototypeUrlField: string,
 *     restrictMode: string,
 * }}
 */
function getSettings(globalConfig, base) {
  const isEnforced = Boolean(globalConfig.get(ConfigKeys.IS_ENFORCED));
  const urlFieldId = globalConfig.get(ConfigKeys.URL_FIELD_ID);
  const urlTableId = globalConfig.get(ConfigKeys.URL_TABLE_ID);
  const isCustomApi = globalConfig.get(ConfigKeys.IS_CUSTOM_API);
  const customApiUrl = globalConfig.get(ConfigKeys.CUSTOM_WEB_API) || "";
  const customBlobStore = globalConfig.get(ConfigKeys.CUSTOM_BLOB_STORE) || "";
  const prototypeUrlFieldId = globalConfig.get(ConfigKeys.PROTOTYPE_URL_FIELD);
  const restrictMode = globalConfig.get(ConfigKeys.RESTRICT_MODE) || "both";

  const urlTable = base.getTableByIdIfExists(urlTableId);
  const urlField = urlTable ? urlTable.getFieldByIdIfExists(urlFieldId) : null;
  const prototypeUrlField = urlTable
    ? urlTable.getFieldByIdIfExists(prototypeUrlFieldId)
    : null;

  return {
    isEnforced,
    urlField,
    urlTable,
    isCustomApi,
    customApiUrl,
    customBlobStore,
    prototypeUrlField,
    restrictMode,
  };
}

/**
 * Wraps the settings with validation information
 * @param {object} settings - The object returned by getSettings
 * @returns {{settings: *, isValid: boolean}|{settings: *, isValid: boolean, message: string}}
 */
function getSettingsValidationResult(settings) {
  const {
    isEnforced,
    urlTable,
    urlField,
    isCustomApi,
    customApiUrl,
    customBlobStore,
    prototypeUrlField,
  } = settings;
  let isValid = true;
  let message = null;
  // If the enforcement switch is set to "Yes"...
  if (isEnforced) {
    if (!urlTable) {
      // If table has not yet been selected...
      isValid = false;
      message = "Please select a table for Sketches";
    } else if (!urlField) {
      // If a table has been selected, but no field...
      isValid = false;
      message = "Please select a field for sketches.";
    } else if (!allowedUrlFieldTypes.includes(urlField.type)) {
      isValid = false;
      message = "Please select an attachment field for sketches";
    }
  }

  if (isCustomApi) {
    if (!customApiUrl) {
      // If Web API url has not been provided...
      isValid = false;
      message =
        "Please provide the web API base URI for custom implementation.";
    } else if (!customBlobStore) {
      isValid = false;
      message =
        "Please provide the URL of the Azure blob storage which is used by Sketch2Code API.";
    }
  }

  if (
    prototypeUrlField &&
    !allowedPrototypeUrlFieldTypes.includes(prototypeUrlField.type)
  ) {
    isValid = false;
    message = "Please select a URL field for storing prototype URLs";
  }

  return {
    isValid,
    message,
    settings,
  };
}

/**
 * A React hook to validate and access settings configured in SettingsForm.
 * @returns {{settings: *, isValid: boolean, message: string}|{settings: *, isValid: boolean}}
 */
export function useSettings() {
  const base = useBase();
  const globalConfig = useGlobalConfig();
  const settings = getSettings(globalConfig, base);
  return getSettingsValidationResult(settings);
}
