import React, { useState, useRef, useEffect } from "react";
import { Box, Button, Text, Dialog, Heading, Input } from "@airtable/blocks/ui";
import { SketchField, Tools } from "react-sketch";
import { FieldType } from "@airtable/blocks/models";
import { useRecordById } from "@airtable/blocks/ui";
import axios from "axios";
import queryString from "querystring";

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
    onSelect(Tools.Select)
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
      <ToolButton key="clear" onClick={clear}>
        Clear
      </ToolButton>
      <ToolButton key="load" disabled={!canLoad} onClick={load}>
        {isLoading? "Loading" : "Load"}
      </ToolButton>
      <ToolButton
        variant="primary"
        key="save"
        disabled={!canSave}
        onClick={save}
      >
        {isSaving ? "Saving": "Save"}
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

  const sketchRef = useRef(null);
  const selectedField = activeTable.getFieldByIdIfExists(selectedFieldId);

  const selectedRecord = useRecordById(
    activeTable,
    selectedRecordId ? selectedRecordId : "",
    {
      fields: [selectedField],
    }
  );

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
    console.log(s2cGetOriginal(jsonFolderId, { "content-type": "text/html" }));
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
                  "content-type": "text/html",
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

  const load = async () => {
    setIsLoading(true);
    const cellValue = selectedRecord.getCellValue(selectedField);
    const [sketchAttachment] = cellValue.filter(
      (attachmentObj) => attachmentObj.filename === "sketch.json"
    );
    const sketchUrl = selectedRecord.getAttachmentClientUrlFromCellValueUrl(
      sketchAttachment.id,
      sketchAttachment.url
    );
    const { data: sketchJSON } = await axios.get(sketchUrl);
    setSketchValue(sketchJSON);
    setIsLoading(false);
  };

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
          backgroundColor="#ffffff"
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
    </Box>
  );
};

export default Canvas;
