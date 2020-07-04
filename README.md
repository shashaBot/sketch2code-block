# Sketch2Code block

This blocks allows UI designers to build prototypes in seconds from UI Sketches using the [Sketch2Code API](https://github.com/microsoft/ailab/tree/master/Sketch2Code).

The user can create and edit sketches without leaving their collaboration space in airtable. When they have created a sketch, then can click on "Code" tab to generate HTML Code based on their sketch in a few seconds.

## How to run this block

1. Copy [this base](https://airtable.com/shrg3CySSks0nRw5w).

2. Create a new custom block in your new base (see
   [Create a new block](https://airtable.com/developers/blocks/guides/hello-world-tutorial#create-a-new-block)), select GitHub template and provide URL of this repository.

3. (Optional) Set up your Sketch2Code API and Blob Storage following the docs [here](https://github.com/microsoft/ailab/blob/master/Sketch2Code/README.md)

4. From the root of your new block, run `block run`.

5. Optionally, you can provide your custom trained API and Blob storage URL (created in step 3 above) during configuration of the block.
