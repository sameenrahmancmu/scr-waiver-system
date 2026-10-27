// Utah statutory lien-waiver bodies + coversheet. {{tokens}} filled at render time.
// Statutory forms per Utah Code 38-1a-802. Edit freely in the Templates tab.

const BODY_INTRO = `<p>To the extent provided below, this document becomes effective to release and the undersigned is considered to waive any right under Utah Code Ann., Title 38, Chapter 1a, Preconstruction and Construction Liens, or any bond right under Utah Code Ann., Title 14, Contractors' Bonds, or Section 63G-6a-1103 related to payment rights the undersigned has on the above described Property once:</p>
<p>(1) the undersigned endorses a check in the above referenced amount payable to the undersigned; and<br>(2) the check is paid by the depository institution on which it is drawn.</p>`;

const WARRANT = `<p>The undersigned warrants that the undersigned either has already paid or will use the money the undersigned receives from this payment promptly to pay in full all the undersigned's laborers, subcontractors, materialmen, and suppliers for all work, materials, equipment, or combination of work, materials, and equipment that are the subject of this waiver and release.</p>`;

const HEADER = `
<div class="wv-head">
  <h1>{{TITLE}}</h1>
  <table class="wv-meta">
    <tr><td class="lbl">PROPERTY/PROJECT NAME:</td><td>{{PROJECT}}</td></tr>
    <tr><td class="lbl">PROPERTY COUNTY LOCATION:</td><td>{{COUNTY}}</td></tr>
    <tr><td class="lbl">PROPERTY PARCEL NUMBER:</td><td>SEE EXHIBIT A</td></tr>
    <tr><td class="lbl">FILER NAME:</td><td><b>{{VENDOR}}</b></td></tr>
    <tr><td class="lbl">SCR ENTRY NUMBER(S):</td><td>{{ENTRIES}}</td></tr>
  </table>
</div>`;

const AMOUNTS_PROGRESS = `
<p class="fld">AMOUNT OWING: {{AMOUNT}}</p>
<p class="fld">PAYMENT PERIOD: {{PERIOD}}</p>`;
const AMOUNTS_FINAL = `
<p class="fld">AMOUNT OWING: {{AMOUNT}}</p>
<p class="fld">GOOD THRU DATE: {{GOODTHRU}}</p>`;

const SIGBLOCK = `
<div class="wv-sig">
  <p>Company/Filer: <b>{{VENDOR}}</b></p>
  <p>Date: __________________</p>
  <br>
  <p>By: ________________________________________________</p>
  <br>
  <p>Its: ________________________________________________</p>
</div>`;

const EXHIBIT = `
<div class="wv-exhibit">
  <h2>EXHIBIT A — SCR ENTRIES AND ASSOCIATED PARCELS</h2>
  <p><b>Filer:</b> {{VENDOR}}</p>
  {{EXHIBIT_ROWS}}
</div>`;

function waiver(kind, stage) {
  const title = `UTAH ${kind.toUpperCase()} WAIVER AND RELEASE UPON ${stage.toUpperCase()} PAYMENT`;
  const amounts = stage === 'Progress' ? AMOUNTS_PROGRESS : AMOUNTS_FINAL;
  const scope = stage === 'Progress'
    ? `<p>This waiver and release applies to a progress payment for the work, materials, equipment, or a combination of work, materials, and equipment furnished by the undersigned to the Property or to the Undersigned's Customer which are the subject of the Invoice or Payment Application, but only to the extent of the Payment Amount. This waiver and release does not apply to any retention withheld; any items, modifications, or changes pending approval; disputed items and claims; or items furnished or invoiced after the Payment Period.</p>`
    : `<p>This waiver and release applies to the final payment for the work, materials, equipment, or combination of work, materials, and equipment furnished by the undersigned to the Property or to the Undersigned's Customer, but only to the extent of the Payment Amount.</p>`;
  return HEADER + amounts + BODY_INTRO + scope + WARRANT + SIGBLOCK + EXHIBIT;
}

const coversheet = `
<div class="cs">
  <h1>LIEN WAIVER REQUEST</h1>
  <p class="cs-sub">Old Republic Title — {{PROJECT}}</p>
  <table class="cs-meta">
    <tr><td class="lbl">Title File #:</td><td>{{FILE_NO}}</td><td class="lbl">Date:</td><td>{{REQUEST_DATE}}</td></tr>
    <tr><td class="lbl">Vendor / Filer:</td><td>{{VENDOR}}</td><td class="lbl">Trade:</td><td>{{TRADE}}</td></tr>
    <tr><td class="lbl">SCR Entry #(s):</td><td colspan="3">{{ENTRIES}}</td></tr>
    <tr><td class="lbl">Waiver requested:</td><td>{{WAIVER_TYPE}} — {{STAGE}}</td><td class="lbl">Due back by:</td><td>{{DUE_DATE}}</td></tr>
    <tr><td class="lbl">Requested by:</td><td>{{REQUESTOR}}</td><td class="lbl">Return to:</td><td>{{REQUESTOR_EMAIL}}</td></tr>
  </table>
  <p class="cs-body">Please execute the attached Utah statutory lien waiver and release and return it to the requestor by the date above. Questions regarding this request may be directed to the Old Republic Title escrow team.</p>
  <p class="cs-body">This request is issued in connection with preliminary notice(s) filed on the above project in the Utah State Construction Registry. The associated SCR entry number(s) and parcels appear on Exhibit A of the attached waiver.</p>
</div>`;

const defaults = [
  { kind: 'Conditional',   stage: 'Progress', title: 'Utah Conditional Waiver and Release Upon Progress Payment',   body: waiver('Conditional','Progress') },
  { kind: 'Unconditional', stage: 'Progress', title: 'Utah Unconditional Waiver and Release Upon Progress Payment', body: waiver('Unconditional','Progress') },
  { kind: 'Conditional',   stage: 'Final',    title: 'Utah Conditional Waiver and Release Upon Final Payment',      body: waiver('Conditional','Final') },
  { kind: 'Unconditional', stage: 'Final',    title: 'Utah Unconditional Waiver and Release Upon Final Payment',    body: waiver('Unconditional','Final') },
  { kind: 'Coversheet',    stage: '',         title: 'Lien Waiver Request Coversheet',                               body: coversheet },
];

module.exports = { defaults };
