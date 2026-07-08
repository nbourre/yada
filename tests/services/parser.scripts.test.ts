/**
 * Unit tests for the script/layout extraction added for ScriptsView (T097):
 * - ScriptCatalog Group-folder recursion (same bug class as LayoutCatalog)
 * - runFullAccess / includeInMenu attribute extraction
 * - StepText -> ScriptStep.text (FileMaker's own human-readable rendering)
 * - "Set Variable" step parsing
 * - Layout.scripts populated from ScriptTriggers + button "Perform Script" steps
 *
 * Drives the parser's fast-xml-parser entry point directly with a synthetic
 * DDR fragment (bypassing file I/O/BOM handling), mirroring the structures
 * confirmed against real fixtures during development.
 */

import { xmlParserService } from '../../src/services/parser.service';
import { Layout, Script } from '../../src/models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = xmlParserService as any;

const XML = `<?xml version="1.0"?>
<FMPReport version="19.0">
<File name="test.fmp12">
<BaseTableCatalog>
<BaseTable name="Invoice">
<FieldCatalog>
<Field id="1" dataType="Number" fieldType="Normal" name="Total"/>
</FieldCatalog>
</BaseTable>
</BaseTableCatalog>
<LayoutCatalog>
<Group name="Invoices">
<Layout id="1" name="InvoiceDetail">
<Table id="1" name="Invoice"/>
<ScriptTriggers>
<Trigger event="OnLayoutEnter" id="1">
<Script id="10" name="Init"/>
</Trigger>
</ScriptTriggers>
<Object type="Button" key="1">
<ButtonObj>
<Step enable="True" id="1" name="Perform Script">
<StepText>Perform Script [ "SaveRecord" ]</StepText>
<Script id="11" name="SaveRecord"/>
</Step>
</ButtonObj>
</Object>
</Layout>
</Group>
</LayoutCatalog>
<ScriptCatalog>
<Group name="System">
<Group name="Nested">
<Script id="10" name="Init" runFullAccess="True" includeInMenu="False">
<StepList>
<Step enable="True" id="1" name="# (comment)">
<StepText>#Init the app</StepText>
</Step>
<Step enable="True" id="2" name="Set Variable">
<StepText>Set Variable [ $x; Value:1 ]</StepText>
<Value>
<Calculation><![CDATA[1]]></Calculation>
</Value>
<Name>$x</Name>
</Step>
<Step enable="True" id="3" name="Perform Script">
<StepText>Perform Script [ "SaveRecord" ]</StepText>
<Script id="11" name="SaveRecord"/>
</Step>
<Step enable="True" id="4" name="If">
<StepText>If [ not EMP__EMPLOYES::id = $id ]</StepText>
<Calculation><![CDATA[not EMP__EMPLOYES::id = $id]]></Calculation>
<DisplayCalculation>
<Chunk type="FunctionRef">not</Chunk>
<Chunk type="NoRef"> </Chunk>
<Chunk type="FieldRef">
<Field table="EMP__EMPLOYES" id="26" name="id"/>
</Chunk>
<Chunk type="NoRef"> = $id</Chunk>
</DisplayCalculation>
</Step>
</StepList>
</Script>
</Group>
</Group>
<Script id="11" name="SaveRecord" runFullAccess="False" includeInMenu="True">
<StepList>
<Step enable="False" id="1" name="Commit Records/Requests">
<StepText>Commit Records/Requests [ No dialog ]</StepText>
</Step>
</StepList>
</Script>
</ScriptCatalog>
</File>
</FMPReport>`;

describe('parser.service — script/layout extraction (T097)', () => {
  let layouts: Layout[];
  let scripts: Script[];

  beforeAll(async () => {
    svc.resetState();
    svc.currentProject = { id: 'test-proj', metadata: {} };
    await svc.parseXMLContent(XML);
    layouts = svc.layouts;
    scripts = svc.scripts;
  });

  it('collects scripts nested arbitrarily deep in Group folders, alongside flat ones', () => {
    expect(scripts.map(s => s.name).sort()).toEqual(['Init', 'SaveRecord']);
  });

  it('extracts runFullAccess and includeInMenu as booleans', () => {
    const init = scripts.find(s => s.name === 'Init')!;
    const save = scripts.find(s => s.name === 'SaveRecord')!;
    expect(init.runWithFullAccess).toBe(true);
    expect(init.includeInMenu).toBe(false);
    expect(save.runWithFullAccess).toBe(false);
    expect(save.includeInMenu).toBe(true);
  });

  it('extracts StepText as the human-readable step.text for every step kind', () => {
    const init = scripts.find(s => s.name === 'Init')!;
    expect(init.steps.map(s => s.text)).toEqual([
      '#Init the app',
      'Set Variable [ $x; Value:1 ]',
      'Perform Script [ "SaveRecord" ]',
      'If [ not EMP__EMPLOYES::id = $id ]',
    ]);
  });

  it('falls back to the step name when disabled/plain steps have no richer text', () => {
    const save = scripts.find(s => s.name === 'SaveRecord')!;
    expect(save.steps[0].enabled).toBe(false);
    expect(save.steps[0].text).toBe('Commit Records/Requests [ No dialog ]');
  });

  it('parses "Set Variable" steps into variableName + calculation', () => {
    const init = scripts.find(s => s.name === 'Init')!;
    const setVar = init.steps.find(s => s.step === 'Set Variable')!;
    expect(setVar.options).toEqual({
      variableName: '$x',
      calculation: '1',
      fieldRefs: [],
      functionRefs: [],
    });
  });

  it('populates Layout.scripts from both ScriptTriggers and button Perform Script steps', () => {
    const layout = layouts.find(l => l.name === 'InvoiceDetail')!;
    expect(layout.scripts.sort()).toEqual(['Init', 'SaveRecord']);
  });

  it('extracts FieldRef/FunctionRef chunks from an "If" step\'s DisplayCalculation', () => {
    // Regression test for a real-world case: a field reference nested
    // inside an "If" step's calculation (e.g. "not EMP__EMPLOYES::id = $id")
    // was invisible in dependencies because it lived in another file of a
    // multi-file solution. FileMaker's own DisplayCalculation chunks
    // disambiguate the reference regardless of whether it resolves locally.
    const init = scripts.find(s => s.name === 'Init')!;
    const ifStep = init.steps.find(s => s.step === 'If')!;
    expect(ifStep.options?.fieldRefs).toEqual([{ table: 'EMP__EMPLOYES', name: 'id' }]);
    expect(ifStep.options?.functionRefs).toEqual(['not']);
  });
});
