// Utah statutory lien-waiver bodies (Utah Code 38-1a-802) + request coversheet.
// {{TOKENS}} are filled per order at print time. {{EXHIBIT}} renders Exhibit A.

const head = (title) => `
<h1 class="wv-title">${title}</h1>
<table class="wv-fields">
  <tr><td>PROPERTY/PROJECT NAME:</td><td><mark>{{PROJECT}}</mark></td></tr>
  <tr><td>PROPERTY COUNTY LOCATION:</td><td><mark>{{COUNTY}}</mark></td></tr>
  <tr><td>PROPERTY PARCEL NUMBER:</td><td>SEE EXHIBIT A</td></tr>
  <tr><td>FILER NAME:</td><td><b>{{VENDOR}}</b></td></tr>
  <tr><td>SCR ENTRY NUMBER(S):</td><td><b>{{ENTRIES}}</b></td></tr>
</table>`;

const progressAmt = `
<p class="wv-line">AMOUNT OWING: <u>{{AMOUNT}}</u></p>
<p class="wv-line">PAYMENT PERIOD: <u>{{THROUGH}}</u></p>`;
const finalAmt = `
<p class="wv-line">AMOUNT OWING: <u>{{AMOUNT}}</u></p>
<p class="wv-line">GOOD THRU DATE: <u>{{THROUGH}}</u></p>`;

const condIntro = `
<p>To the extent provided below, this document becomes effective to release and the undersigned is considered to waive any notice of lien or right under Utah Code Ann., Title 38, Chapter 1a, Preconstruction and Construction Liens, or any bond right under Utah Code Ann., Title 14, Contractors' Bonds, or Section 63G-6a-1103 related to payment rights the undersigned has on the above described Property once:</p>
<p class="wv-ind">(1) the undersigned endorses a check in the above referenced Payment Amount payable to the undersigned; and</p>
<p class="wv-ind">(2) the check is paid by the depository institution on which it is drawn.</p>`;

const warrant = `
<p>The undersigned warrants that the undersigned either has already paid or will use the money the undersigned receives from this payment promptly to pay in full all the undersigned's laborers, subcontractors, materialmen, and suppliers for all work, materials, equipment, or combination of work, materials, and equipment that are the subject of this waiver and release.</p>`;

const notice = `
<p class="wv-notice">NOTICE: This document waives rights unconditionally and states that you have been paid for giving up those rights. It is prohibited for a person to require you to sign this document if you have not been paid the payment amount set forth above. If you have not been paid, use a conditional release form.</p>`;

const sig = `
<div class="wv-sig">
  <p>Company/Filer: <b>{{VENDOR}}</b></p>
  <p>Date: ______________________</p>
  <p class="wv-sp">By: _________________________________________________</p>
  <p class="wv-sp">Its: _________________________________________________</p>
</div>
<div class="pagebreak"></div>
{{EXHIBIT}}`;

const bodies = {
  'Conditional|Progress': head('UTAH CONDITIONAL WAIVER AND RELEASE UPON PROGRESS PAYMENT') + progressAmt + condIntro + `
<p>This waiver and release applies to a progress payment for the work, materials, equipment, or a combination of work, materials, and equipment furnished by the undersigned to the Property or to the Undersigned's Customer which are the subject of the Invoice or Payment Application, but only to the extent of the Payment Amount. This waiver and release does not apply to any retention withheld; any items, modifications, or changes pending approval; disputed items and claims; or items furnished or invoiced after the Payment Period.</p>` + warrant + sig,

  'Conditional|Final': head('UTAH CONDITIONAL WAIVER AND RELEASE UPON FINAL PAYMENT') + finalAmt + condIntro + `
<p>This waiver and release applies to the final payment for the work, materials, equipment, or combination of work, materials, and equipment furnished by the undersigned to the Property or to the Undersigned's Customer.</p>` + warrant + sig,

  'Unconditional|Progress': head('UTAH UNCONDITIONAL WAIVER AND RELEASE UPON PROGRESS PAYMENT') + progressAmt + `
<p>The undersigned has been paid and has received a progress payment in the above referenced Payment Amount for all work, materials, equipment, or a combination of work, materials, and equipment the undersigned furnished to the Customer for the above described Property and does hereby waive and release any notice of lien or right under Utah Code Ann., Title 38, Chapter 1a, Preconstruction and Construction Liens, or any bond right under Utah Code Ann., Title 14, Contractors' Bonds, or Section 63G-6a-1103 related to payment rights the undersigned has on the above described Property to the following extent.</p>
<p>This waiver and release applies to a progress payment for the work, materials, equipment, or a combination of work, materials, and equipment furnished by the undersigned to the Property or to the Undersigned's Customer which are the subject of the Invoice or Payment Application, but only to the extent of the Payment Amount. This waiver and release does not apply to any retention withheld; any items, modifications, or changes pending approval; disputed items and claims; or items furnished or invoiced after the Payment Period.</p>` + warrant + notice + sig,

  'Unconditional|Final': head('UTAH UNCONDITIONAL WAIVER AND RELEASE UPON FINAL PAYMENT') + finalAmt + `
<p>The undersigned has been paid in full for all work, materials, equipment, or a combination of work, materials, and equipment the undersigned furnished for the above described Property and does hereby waive and release any notice of lien or right under Utah Code Ann., Title 38, Chapter 1a, Preconstruction and Construction Liens, or any bond right under Utah Code Ann., Title 14, Contractors' Bonds, or Section 63G-6a-1103 related to payment rights the undersigned has on the above described Property.</p>` + warrant + notice + sig,
};

const coversheet = `
<div class="cs">
  <div class="cs-top">
    <div><div class="cs-co">{{COMPANY}}</div><div class="cs-dept">Escrow · Construction Disbursement</div></div>
    <div class="cs-badge">LIEN WAIVER REQUEST</div>
  </div>
  <table class="cs-grid">
    <tr><th>To (Vendor / Filer)</th><td><b>{{VENDOR}}</b><br>{{VENDOR_EMAIL}}<br>{{VENDOR_PHONE}}</td>
        <th>From</th><td><b>{{REQUESTOR}}</b><br>{{REQUESTOR_EMAIL}}</td></tr>
    <tr><th>Title File #</th><td>{{FILE_NO}}</td><th>Request Date</th><td>{{REQUEST_DATE}}</td></tr>
    <tr><th>Project</th><td>{{PROJECT}}</td><th>County</th><td>{{COUNTY}}</td></tr>
    <tr><th>Owner</th><td>{{OWNER}}</td><th>General Contractor</th><td>{{GC}}</td></tr>
    <tr><th>Waiver Requested</th><td><b>{{WAIVER_TYPE}} — {{STAGE}} Payment</b></td><th>Return By</th><td class="cs-due">{{DUE_DATE}}</td></tr>
    <tr><th>Amount</th><td>{{AMOUNT}}</td><th>Through / Good-Thru</th><td>{{THROUGH}}</td></tr>
    <tr><th>SCR Entry #(s)</th><td colspan="3">{{ENTRIES}}</td></tr>
  </table>
  <h3>Instructions</h3>
  <ol>
    <li>Review the attached Utah statutory waiver and Exhibit A (your SCR entries and parcels).</li>
    <li>Complete the amount / date lines if blank, sign, and date.</li>
    <li>Return the signed waiver to <b>{{REQUESTOR_EMAIL}}</b> by <b>{{DUE_DATE}}</b>.</li>
  </ol>
  <p class="cs-fine">This request relates to preliminary notice(s) you filed in the Utah State Construction Registry for the project above. Payment may be held until a properly executed waiver is received. Questions: {{REQUESTOR}}, {{REQUESTOR_EMAIL}}.</p>
</div>`;

const defaults = [
  { kind: 'Conditional', stage: 'Progress', title: 'Conditional Waiver — Progress Payment', body: bodies['Conditional|Progress'] },
  { kind: 'Conditional', stage: 'Final', title: 'Conditional Waiver — Final Payment', body: bodies['Conditional|Final'] },
  { kind: 'Unconditional', stage: 'Progress', title: 'Unconditional Waiver — Progress Payment', body: bodies['Unconditional|Progress'] },
  { kind: 'Unconditional', stage: 'Final', title: 'Unconditional Waiver — Final Payment', body: bodies['Unconditional|Final'] },
  { kind: 'Coversheet', stage: '', title: 'Request Coversheet', body: coversheet },
];

module.exports = { defaults };
