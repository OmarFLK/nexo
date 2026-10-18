import type {NextConfig} from 'next';
import {networkInterfaces} from 'node:os';
const localAddresses=Object.values(networkInterfaces()).flatMap(items=>(items??[]).map(item=>item.address));
const upstream=process.env.NEXO_API_URL;
if(upstream&&new URL(upstream).protocol!=='https:'&&process.env.NEXO_TEST_MODE!=='1')throw Error('NEXO_API_URL deve usar HTTPS.');
const config:NextConfig={
  distDir:process.env.NEXO_BUILD_DIR??'.next',
  serverExternalPackages:['node:sqlite','pg'],poweredByHeader:false,devIndicators:false,
  allowedDevOrigins:['localhost','127.0.0.1',...localAddresses],
  productionBrowserSourceMaps:false,
  async headers(){return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'same-origin'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'X-Robots-Tag',value:'noindex, nofollow'},
    ...(process.env.NODE_ENV==='production'&&process.env.NEXO_TEST_MODE!=='1'?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[]),
  ]}];},
};
export default config;
