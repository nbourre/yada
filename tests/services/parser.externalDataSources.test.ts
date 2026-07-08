/**
 * Unit tests for ExternalDataSourcesCatalog extraction: a table occurrence's
 * own <FileReference id="X"/> is resolved (via ExternalDataSourcesCatalog's
 * <FileReference id="X" link="other_fmp12.xml"/>) into Table.externalFile,
 * so cross-file dependency references can name the actual file instead of
 * just failing to resolve silently. A purely local occurrence (no
 * <FileReference> at all) must not get an externalFile.
 */

import { xmlParserService } from '../../src/services/parser.service';
import { Table } from '../../src/models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = xmlParserService as any;

const XML = `<?xml version="1.0"?>
<FMPReport version="19.0">
<File name="ui.fmp12">
<BaseTableCatalog>
<BaseTable name="orders">
<FieldCatalog>
<Field id="1" dataType="Number" fieldType="Normal" name="id"/>
</FieldCatalog>
</BaseTable>
</BaseTableCatalog>
<ExternalDataSourcesCatalog>
<FileReference link="data_fmp12.xml" id="1" pathList="file:data" name="data"/>
</ExternalDataSourcesCatalog>
<RelationshipGraph>
<TableList>
<Table id="100" name="ORDERS" baseTable="orders"/>
<Table id="101" name="EMP__EMPLOYES" baseTable="employes">
<FileReference id="1" name="data"/>
</Table>
</TableList>
<RelationshipList>
<Relationship id="1">
<LeftTable name="ORDERS"/>
<RightTable name="EMP__EMPLOYES"/>
<JoinPredicateList>
<JoinPredicate type="=">
<LeftField><Field name="employeId"/></LeftField>
<RightField><Field name="id"/></RightField>
</JoinPredicate>
</JoinPredicateList>
</Relationship>
</RelationshipList>
</RelationshipGraph>
</File>
</FMPReport>`;

describe('parser.service — ExternalDataSourcesCatalog extraction', () => {
  let tables: Table[];

  beforeAll(async () => {
    svc.resetState();
    svc.currentProject = { id: 'test-proj', metadata: {} };
    await svc.parseXMLContent(XML);
    tables = svc.tables;
  });

  it("resolves an external occurrence's FileReference to the actual DDR filename", () => {
    const emp = tables.find((t: Table) => t.name === 'EMP__EMPLOYES')!;
    expect(emp.externalFile).toBe('data_fmp12.xml');
  });

  it('leaves externalFile unset for a purely local occurrence', () => {
    const orders = tables.find((t: Table) => t.name === 'ORDERS')!;
    expect(orders.externalFile).toBeUndefined();
  });
});
