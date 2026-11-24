const {randomBytes}=require('node:crypto');
module.exports=function advertisingHtml(html,response){
  if(!html.includes('data-r3-ad'))return html;
  const nonce=randomBytes(24).toString('base64');
  response.setHeader('Content-Security-Policy',`object-src 'none'; base-uri 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`);
  return html.replace(/<script\b(?![^>]*\bnonce=)/gi,`<script nonce="${nonce}"`);
};
