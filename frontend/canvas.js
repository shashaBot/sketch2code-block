import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Text,
  Dialog,
  Heading,
  Input,
  useWatchable,
  registerRecordActionDataCallback
} from "@airtable/blocks/ui";

import { cursor } from "@airtable/blocks";

import { SketchField, Tools } from "react-sketch";
import { FieldType } from "@airtable/blocks/models";
import { useRecordById } from "@airtable/blocks/ui";
import axios from "axios";

import { useSettings } from "./settings";

const ToolButton = (props) => {
  return <Button width="90px" marginBottom="4px" {...props} />;
};

const ToolSet = ({
  activeTool,
  onSelect,
  save,
  addText,
  clear,
  enableRemoveSelected,
  enableCopyPaste,
  copy,
  removeSelected,
  canSave,
  load,
  canLoad,
  isSaving,
  isLoading,
  canUndo,
  undo,
  canRedo,
  redo,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [textValue, setTextValue] = useState("");

  const createText = () => {
    addText(textValue);
    setTextValue("");
    setIsDialogOpen(false);
    onSelect(Tools.Select);
  };

  return (
    <>
      {enableCopyPaste && <ToolButton onClick={copy}>Copy</ToolButton>}
      {enableRemoveSelected && (
        <ToolButton variant="danger" onClick={removeSelected}>
          Remove
        </ToolButton>
      )}
      {Object.keys(Tools).map((toolKey) => (
        <ToolButton
          key={toolKey}
          variant={activeTool === Tools[toolKey] ? "secondary" : "default"}
          onClick={() => onSelect(Tools[toolKey])}
        >
          {toolKey}
        </ToolButton>
      ))}
      <ToolButton key="text" onClick={() => setIsDialogOpen(true)}>
        Text
      </ToolButton>
      {isDialogOpen && (
        <Dialog onClose={() => setIsDialogOpen(false)} width="320px">
          <Dialog.CloseButton />
          <Heading>Add Text</Heading>
          <Input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            marginBottom={2}
          />
          <Button onClick={createText}>Add</Button>
        </Dialog>
      )}
      <ToolButton disabled={!canUndo} key="undo" onClick={undo}>
        Undo
      </ToolButton>
      <ToolButton disabled={!canRedo} key="redo" onClick={redo}>
        Redo
      </ToolButton>
      <ToolButton key="clear" onClick={clear}>
        Clear
      </ToolButton>
      <ToolButton key="load" disabled={!canLoad} onClick={load}>
        {isLoading ? "Loading" : "Load"}
      </ToolButton>
      <ToolButton
        variant="primary"
        key="save"
        disabled={!canSave}
        onClick={save}
      >
        {isSaving ? "Saving" : "Save"}
      </ToolButton>
    </>
  );
};

const Canvas = ({
  activeTable,
  selectedRecordId,
  selectedFieldId,
  s2cSaveFile,
  s2cGetOriginal,
  restrictMode
}) => {
  const [tool, setTool] = useState(Tools.Pencil);
  const [sketchValue, setSketchValue] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [enableCopyPaste, setEnableCopyPaste] = useState(false);
  const [enableRemoveSelected, setEnableRemoveSelected] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  const sketchRef = useRef(null);

  const {
    settings: { isEnforced, urlField, urlTable },
  } = useSettings();

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

  useEffect( () => {
    if (restrictMode === "sketch" && previewField === urlField && selectedRecord) {
      load()
    }
  }, [restrictMode, load, previewField, urlField, selectedRecord])

  // Triggers a re-render if the user switches table or view.
  // RecordPreview may now need to render a preview, or render nothing at all.
  useWatchable(cursor, ["activeTableId", "activeViewId"]);

  // Remove error when the selected record changes.
  useEffect(() => {
    setError("");
  }, [selectedRecord]);

  // const onRecordAction = useCallback( (data) => {
  // })

  // useEffect(() => {
  //   // Return the unsubscribe function to ensure we clean up the handler.
  //   return registerRecordActionDataCallback(onRecordAction);
  // }, [onRecordAction]);

  const addText = (text) => {
    sketchRef.current.addText(text);
  };

  const onSketchChange = () => {
    let prev = canUndo;
    let now = sketchRef.current.canUndo();
    if (prev !== now) {
      setCanUndo(now);
    }
  };

  const clear = () => {
    sketchRef.current.clear();
    setSketchValue(null);
    setBackgroundColor("#ffffff");
    setCanUndo(sketchRef.current.canUndo());
    setCanRedo(sketchRef.current.canRedo());
  };

  const undo = () => {
    sketchRef.current.undo();
    setCanUndo(sketchRef.current.canUndo());
    setCanRedo(sketchRef.current.canRedo());
  };

  const redo = () => {
    sketchRef.current.redo();
    setCanUndo(sketchRef.current.canUndo());
    setCanRedo(sketchRef.current.canRedo());
  };

  const removeSelected = () => {
    sketchRef.current.removeSelected();
  };

  const copyPaste = () => {
    sketchRef.current.copy();
    sketchRef.current.paste();
  };

  const onToolSelect = (tool) => {
    setTool(tool);
    const isSelectTool = tool === Tools.Select;
    setEnableCopyPaste(isSelectTool);
    setEnableRemoveSelected(isSelectTool);
  };

  const save = async () => {
    setIsSaving(true);
    const {
      data: { folderId: imageFolderId },
    } = await s2cSaveFile(sketchRef.current.toDataURL());

    setSketchValue(sketchRef.current.toJSON());

    const encodedSketch = btoa(JSON.stringify(sketchRef.current.toJSON()));
    const {
      data: { folderId: jsonFolderId },
    } = await s2cSaveFile("blah," + encodedSketch);
    console.log(s2cGetOriginal(jsonFolderId, { "content-type": "text/json" }));
    try {
      await activeTable.updateRecordsAsync([
        {
          id: selectedRecordId,
          fields: {
            [selectedFieldId]: [
              {
                url: s2cGetOriginal(imageFolderId),
                filename: "sketch.png",
              },
              {
                url: s2cGetOriginal(jsonFolderId, {
                  "content-type": "text/json",
                }),
                filename: "sketch.json",
              },
            ],
          },
        },
      ]);
    } catch (e) {
      alert("Something went wrong!");
    } finally {
      setIsSaving(false);
    }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    const cellValue = selectedRecord.getCellValue(previewField);
    const [sketchAttachment] = cellValue.filter(
      (attachmentObj) => attachmentObj.filename === "sketch.json"
    );
    if (!sketchAttachment) {
      setError(
        "Could't load sketch. 'sketch.json' was not found in the attachments of the selected record."
      );
    }
    const sketchUrl = selectedRecord.getAttachmentClientUrlFromCellValueUrl(
      sketchAttachment.id,
      sketchAttachment.url
    );
    const { data: sketchJSON } = await axios.get(sketchUrl);
    setSketchValue(sketchJSON);
    onToolSelect(Tools.Select);
    setIsLoading(false);
  }, [selectedRecord, selectedField]);

  // canSave and canLoad
  useEffect(() => {
    if (
      activeTable &&
      selectedFieldId &&
      selectedRecordId &&
      selectedField.type === FieldType.MULTIPLE_ATTACHMENTS &&
      !isSaving &&
      !isLoading
    ) {
      setCanSave(true);
      setCanLoad(true);
    } else {
      setCanSave(false);
      setCanLoad(false);
    }
  }, [
    activeTable,
    selectedFieldId,
    selectedRecordId,
    isSaving,
    setIsSaving,
    setCanSave,
    selectedField,
    isLoading,
  ]);

  // create console.save function for storing the sketch json.
  useEffect(() => {
    (function (console) {
      console.save = function (data, filename) {
        if (!data) {
          console.error("Console.save: No data");
          return;
        }
        if (!filename) filename = "console.json";
        if (typeof data === "object") {
          data = JSON.stringify(data, undefined, 4);
        }
        var blob = new Blob([data], { type: "text/json" }),
          e = document.createEvent("MouseEvents"),
          a = document.createElement("a");
        a.download = filename;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ["text/json", a.download, a.href].join(":");
        e.initMouseEvent(
          "click",
          true,
          false,
          window,
          0,
          0,
          0,
          0,
          0,
          false,
          false,
          false,
          false,
          0,
          null
        );
        a.dispatchEvent(e);
      };
    })(console);
  }, []);

  return (
    <Box
      display="flex"
      width="100%"
      flexDirection="row"
      flexWrap="wrap"
      padding="10px"
      maxWidth="1120px"
    >
      <Box width="70%" border="default" borderRadius="large">
        <SketchField
          tool={tool}
          height="300px"
          lineColor="black"
          lineWidth={3}
          ref={sketchRef}
          backgroundColor={backgroundColor}
          value={sketchValue}
          onChange={onSketchChange}
        />
      </Box>
      <Box
        width="30%"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        paddingLeft="10px"
      >
        <ToolSet
          onSelect={onToolSelect}
          activeTool={tool}
          addText={addText}
          save={save}
          load={load}
          canSave={canSave}
          canLoad={canLoad}
          isLoading={isLoading}
          isSaving={isSaving}
          clear={clear}
          canUndo={canUndo}
          canRedo={canRedo}
          undo={undo}
          redo={redo}
          removeSelected={removeSelected}
          enableCopyPaste={enableCopyPaste}
          enableRemoveSelected={enableRemoveSelected}
          copy={copyPaste}
        />
      </Box>
      <Box marginTop="10px">
        {!canSave && !isSaving && (
          <Text>
            Select an attachment field and then click on Save to store your
            sketch.
          </Text>
        )}
      </Box>
      {error && (
        <Dialog onClose={() => setError("")} maxWidth={400}>
          <Dialog.CloseButton />
          <Heading size="small">Something went wrong</Heading>
          <Text variant="paragraph" marginBottom={0}>
            {error}
          </Text>
        </Dialog>
      )}
    </Box>
  );
};

export default Canvas;
