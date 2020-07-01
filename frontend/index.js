import React, { Fragment, useState, useCallback, useEffect } from "react";
import { cursor } from "@airtable/blocks";
import { ViewType, FieldType } from "@airtable/blocks/models";

import {
  initializeBlock,
  registerRecordActionDataCallback,
  useBase,
  useRecordById,
  useLoadable,
  useSettingsButton,
  useWatchable,
  Box,
  Button,
  Dialog,
  Heading,
  Link,
  Text,
  TextButton,
  Loader,
  SelectButtons,
} from "@airtable/blocks/ui";

import { useSettings } from "./settings";
import SettingsForm from "./SettingsForm";
import queryString from "querystring";
import axios from "axios";
import QRCode from "qrcode.react";

import Canvas from "./canvas";

// How this block chooses the Sketch to show ouput HTML for:
//
// Without a specified Table & Field:
//
//  - When the user selects a cell in grid view and the field's content is
//    an attachment, verifies that it's an image and then generates HTML using
//    the Sketch2Code API and presents it.
//
// To Specify a Table & Field:
//
//  - The user may use "Settings" to choose a specified table and specified
//    field constraint. If the constraint switch is set to "Yes", the user must
//    set a specified table and specified field for URL previews.
//
// With a specified table & specified field:
//
//  - When the user selects a cell in grid view and the active table matches
//    the specified table or when the user opens a record from a button field
//    in the specified table:
//    The block looks in the selected record for the
//    specified field for image attachments and then uses the Sketch2Code API to
//    generate the HTML output for the Sketch

function Sketch2CodeBlock() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useSettingsButton(() => setIsSettingsOpen(!isSettingsOpen));

  const {
    isValid,
    settings: { isEnforced, urlTable },
  } = useSettings();

  // Caches the currently selected record and field in state. If the user
  // selects a record and a preview appears, and then the user de-selects the
  // record (but does not select another), the preview will remain. This is
  // useful when, for example, the user resizes the blocks pane.
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  const [recordActionErrorMessage, setRecordActionErrorMessage] = useState("");

  // cursor.selectedRecordIds and selectedFieldIds aren't loaded by default,
  // so we need to load them explicitly with the useLoadable hook. The rest of
  // the code in the component will not run until they are loaded.
  useLoadable(cursor);

  // Update the selectedRecordId and selectedFieldId state when the selected
  // record or field change.
  useWatchable(cursor, ["selectedRecordIds", "selectedFieldIds"], () => {
    // If the update was triggered by a record being de-selected,
    // the current selectedRecordId will be retained.  This is
    // what enables the caching described above.
    if (cursor.selectedRecordIds.length > 0) {
      // There might be multiple selected records. We'll use the first
      // one.
      setSelectedRecordId(cursor.selectedRecordIds[0]);
    }
    if (cursor.selectedFieldIds.length > 0) {
      // There might be multiple selected fields. We'll use the first
      // one.
      setSelectedFieldId(cursor.selectedFieldIds[0]);
    }
  });

  // Close the record action error dialog whenever settings are opened or the selected record
  // is updated. (This means you don't have to close the modal to see the settings, or when
  // you've opened a different record.)
  useEffect(() => {
    setRecordActionErrorMessage("");
  }, [isSettingsOpen, selectedRecordId]);

  // Register a callback to be called whenever a record action occurs (via button field)
  // useCallback is used to memoize the callback, to avoid having to register/unregister
  // it unnecessarily.
  const onRecordAction = useCallback(
    (data) => {
      // Ignore the event if settings are already open.
      // This means we can assume settings are valid (since we force settings to be open if
      // they are invalid).
      if (!isSettingsOpen) {
        if (isEnforced) {
          if (data.tableId === urlTable.id) {
            setSelectedRecordId(data.recordId);
          } else {
            // Record is from a mismatching table.
            setRecordActionErrorMessage(
              `This block is set up to show HTML Output using records from the "${urlTable.name}" table, but was opened from a different table.`
            );
          }
        } else {
          // Preview is not supported in this case, as we wouldn't know what field to preview.
          // Show a dialog to the user instead.
          setRecordActionErrorMessage(
            'You must enable "Use a specific field for UI Sketches output" to transform sketches with a button field.'
          );
        }
      }
    },
    [isSettingsOpen, isEnforced, urlTable]
  );
  useEffect(() => {
    // Return the unsubscribe function to ensure we clean up the handler.
    return registerRecordActionDataCallback(onRecordAction);
  }, [onRecordAction]);

  // This watch deletes the cached selectedRecordId and selectedFieldId when
  // the user moves to a new table or view. This prevents the following
  // scenario: User selects a record that contains a preview url. The preview appears.
  // User switches to a different table. The preview disappears. The user
  // switches back to the original table. Weirdly, the previously viewed preview
  // reappears, even though no record is selected.
  useWatchable(cursor, ["activeTableId", "activeViewId"], () => {
    setSelectedRecordId(null);
    setSelectedFieldId(null);
  });

  const base = useBase();
  const activeTable = base.getTableByIdIfExists(cursor.activeTableId);

  useEffect(() => {
    // Display the settings form if the settings aren't valid.
    if (!isValid && !isSettingsOpen) {
      setIsSettingsOpen(true);
    }
  }, [isValid, isSettingsOpen]);

  // activeTable is briefly null when switching to a newly created table.
  if (!activeTable) {
    return null;
  }

  return (
    <Box>
      {isSettingsOpen ? (
        <SettingsForm setIsSettingsOpen={setIsSettingsOpen} />
      ) : (
        <RecordPreviewWithDialog
          activeTable={activeTable}
          selectedRecordId={selectedRecordId}
          selectedFieldId={selectedFieldId}
          setIsSettingsOpen={setIsSettingsOpen}
        />
      )}
      {recordActionErrorMessage && (
        <Dialog onClose={() => setRecordActionErrorMessage("")} maxWidth={400}>
          <Dialog.CloseButton />
          <Heading size="small">Can&apos;t preview URL</Heading>
          <Text variant="paragraph" marginBottom={0}>
            {recordActionErrorMessage}
          </Text>
        </Dialog>
      )}
    </Box>
  );
}

// Shows a preview, or a dialog that displays information about what
// kind of services (URLs) are supported by this block.
function RecordPreviewWithDialog({
  activeTable,
  selectedRecordId,
  selectedFieldId,
  setIsSettingsOpen,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState("sketch");

  // Close the dialog when the selected record is changed.
  // The new record might have a preview, so we don't want to hide it behind this dialog.
  useEffect(() => {
    setIsDialogOpen(false);
  }, [selectedRecordId]);

  const {
    settings: { isCustomApi, customApiUrl, customBlobStore },
  } = useSettings();

  let BlobStoreURL = "https://s2cblob.shashwat.workers.dev";
  if (isCustomApi) {
    BlobStoreURL = customBlobStore;
  }

  let s2cApiUrl = "https://s2c.shashwat.workers.dev";
  if (isCustomApi) {
    s2cApiUrl = customApiUrl;
  }

  const s2cSaveFile = async (imgBase64) => {
    const saveRequestBody = { imgBase64: imgBase64.split(",")[1] };
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    return axios.post(
      `${s2cApiUrl}/SaveOriginalFile`,
      queryString.stringify(saveRequestBody),
      config
    );
  };

  const s2cGetOriginal = (folderId, qs) => {
    if (qs) {
      qs = queryString.stringify(qs);
    }
    return `${BlobStoreURL}/${folderId}/original.png?${qs}`;
  };

  return (
    <Fragment>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <SelectButtons
          value={mode}
          onChange={setMode}
          options={[
            { value: "sketch", label: "Sketch" },
            { value: "code", label: "Code" },
          ]}
          width="100%"
        />

        {mode === "sketch" && (
          <Canvas
            activeTable={activeTable}
            selectedRecordId={selectedRecordId}
            selectedFieldId={selectedFieldId}
            s2cGetOriginal={s2cGetOriginal}
            s2cSaveFile={s2cSaveFile}
          />
        )}

        {mode === "code" && (
          <RecordPreview
            activeTable={activeTable}
            selectedRecordId={selectedRecordId}
            selectedFieldId={selectedFieldId}
            setIsDialogOpen={setIsDialogOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            s2cApiUrl={s2cApiUrl}
          />
        )}
      </Box>
      {isDialogOpen && (
        <Dialog onClose={() => setIsDialogOpen(false)} maxWidth={400}>
          <Dialog.CloseButton />
          <Heading size="small">Supported services</Heading>
          <Text marginTop={2}>
            Get full preview using the link or scan QR Code
          </Text>
          <Text marginTop={2}>
            <Link href="https://s2c." target="_blank">
              Airtable share links
            </Link>
            , Figma, SoundCloud, Spotify, Vimeo, YouTube
          </Text>
          <Link
            marginTop={2}
            href="https://airtable.com/shrQSwIety6rqfJZX"
            target="_blank"
          >
            Request a new service
          </Link>
        </Dialog>
      )}
    </Fragment>
  );
}

// Shows a preview, or a message about what the user should do to see a preview.
function RecordPreview({
  activeTable,
  selectedRecordId,
  selectedFieldId,
  setIsSettingsOpen,
  s2cApiUrl
}) {
  const {
    settings: { isEnforced, urlField, urlTable },
  } = useSettings();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const table = (isEnforced && urlTable) || activeTable;

  // We use getFieldByIdIfExists because the field might be deleted.
  const selectedField = selectedFieldId
    ? table.getFieldByIdIfExists(selectedFieldId)
    : null;
  // When using a specific field for previews is enabled and that field exists,
  // use the selectedField
  const previewField = (isEnforced && urlField) || selectedField;
  // Triggers a re-render if the record changes. Preview URL cell value
  // might have changed, or record might have been deleted.
  const selectedRecord = useRecordById(
    table,
    selectedRecordId ? selectedRecordId : "",
    {
      fields: [previewField],
    }
  );

  // Triggers a re-render if the user switches table or view.
  // RecordPreview may now need to render a preview, or render nothing at all.
  useWatchable(cursor, ["activeTableId", "activeViewId"]);
  const [htmlPages, setHtmlPages] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    if (selectedRecord !== null && previewField !== null) {
      if (previewField.type !== FieldType.MULTIPLE_ATTACHMENTS) {
        setError(
          "Please select an attachment field with your UI sketch(es) to see the output."
        );
        return;
      }
      const cellValue = selectedRecord.getCellValue(previewField);
      const updateHtmlPages = {};
      if (!cellValue) {
        setError(
          "There are no attachments. Add a sketch to see its prototype here."
        );
        return;
      }
      cellValue.map((attachmentObj) => {
        const clientUrl = selectedRecord.getAttachmentClientUrlFromCellValueUrl(
          attachmentObj.id,
          attachmentObj.url
        );
        if (!(attachmentObj.id in htmlPages)) {
          const { id: attachmentId } = attachmentObj;
          setLoading(true);
          getHtmlCodeFromSketch(clientUrl, s2cApiUrl).then(
            ([newPage, correlationId]) => {
              updateHtmlPages[attachmentId] = {
                html: newPage,
                s2cFolderId: correlationId,
              };
              setHtmlPages(updateHtmlPages);
              setLoading(false);
            }
          );
        }
      });
    }
  }, [selectedRecord, htmlPages, previewField]);

  if (
    // If there is/was a specified table enforced, but the cursor
    // is not presently in the specified table, display a message to the user.
    // Exception: selected record is from the specified table (has been opened
    // via button field or other means while cursor is on a different table.)
    isEnforced &&
    cursor.activeTableId !== table.id &&
    !(selectedRecord && selectedRecord.parentTable.id === table.id)
  ) {
    return (
      <Fragment>
        <Text paddingX={3}>
          Switch to the “{table.name}” table to see previews.
        </Text>
        <TextButton
          size="small"
          marginTop={3}
          onClick={() => setIsSettingsOpen(true)}
        >
          Settings
        </TextButton>
      </Fragment>
    );
  } else if (
    // activeViewId is briefly null when switching views
    selectedRecord === null &&
    (cursor.activeViewId === null ||
      table.getViewById(cursor.activeViewId).type !== ViewType.GRID)
  ) {
    return <Text>Switch to a grid view to see previews</Text>;
  } else if (
    // selectedRecord will be null on block initialization, after
    // the user switches table or view, or if it was deleted.
    selectedRecord === null ||
    // The preview field may have been deleted.
    previewField === null
  ) {
    return (
      <Fragment>
        <Text style={{ marginTop: "30%" }}>
          Select a sketch attachment to generate its HTML web page.
        </Text>
      </Fragment>
    );
  } else if (error) {
    return (
      <Fragment>
        <Text style={{ marginTop: "30%" }}>{error}</Text>
      </Fragment>
    );
  } else if (loading) {
    return (
      <Box
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        right={0}
        flexDirection="column"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Loader scale={0.3} />
      </Box>
    );
  } else {
    return (
      <Fragment>
        <div
          dangerouslySetInnerHTML={{
            __html:
              htmlPages[Object.keys(htmlPages)[0]] &&
              htmlPages[Object.keys(htmlPages)[0]].html,
          }}
        ></div>
        <Link
          style={{ position: "fixed", bottom: "10px", right: "10px" }}
          target="_blank"
          href={
            htmlPages[Object.keys(htmlPages)[0]] &&
            `${s2cApiUrl}/layout/result/${
              htmlPages[Object.keys(htmlPages)[0]].s2cFolderId
            }`
          }
          icon="download"
        >
          Download
        </Link>
        <TextButton
          style={{ position: "fixed", bottom: "10px", left: "10px" }}
          onClick={() => setIsDialogOpen(true)}
          variant="light"
          icon="hyperlink"
        >
          Device Preview
        </TextButton>

        {isDialogOpen && (
          <Dialog
            onClose={() => setIsDialogOpen(false)}
            maxWidth={400}
            textAlign="center"
          >
            <Dialog.CloseButton />
            <Heading size="small">Test prototype on your device</Heading>
            <Text marginTop={2}>
              Get full preview using the link or scan QR Code
            </Text>
            <Text marginTop={2} marginBottom={4}>
              <Link
                href={`${s2cApiUrl}/layout/result/${
                  htmlPages[Object.keys(htmlPages)[0]].s2cFolderId
                }?download=false`}
                target="_blank"
              >
                Full page preview
              </Link>
            </Text>

            <QRCode
              style={{ display: "block", margin: "auto" }}
              value={`${s2cApiUrl}/layout/result/${
                htmlPages[Object.keys(htmlPages)[0]].s2cFolderId
              }?download=false`}
            />
          </Dialog>
        )}
      </Fragment>
    );
  }
}

async function toDataUrl(url) {
  return new Promise((resolve) => {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      var reader = new FileReader();
      reader.onloadend = function () {
        resolve(reader.result);
      };
      reader.readAsDataURL(xhr.response);
    };
    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.send();
  });
}

async function getHtmlCodeFromSketch(sketchUrl, s2cApiUrl) {
  const imgBase64 = await toDataUrl(sketchUrl);
  const saveRequestBody = { imgBase64: imgBase64.split(",")[1] };
  const config = {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  const saveResponse = await axios.post(
    `${s2cApiUrl}/SaveOriginalFile`,
    queryString.stringify(saveRequestBody),
    config
  );
  const correlationId = saveResponse.data.folderId;
  const uploadRequestBody = { correlationId };
  await axios.post(
    `${s2cApiUrl}/upload`,
    queryString.stringify(uploadRequestBody),
    config
  );
  const result = await axios.get(
    `${s2cApiUrl}/layout/result/${saveResponse.data.folderId}`
  );
  return [result.data, correlationId];
}

initializeBlock(() => <Sketch2CodeBlock />);
