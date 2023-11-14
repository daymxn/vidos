import dedent from "dedent";

export const DISABLE_LOGGING = process.env.DISABLE_LOGGING
export const COMMON_CONFIG_FILE = "local-domains-common.conf"
export const COMMON_CONFIG = dedent`
proxy_http_version 1.1; 
proxy_set_header Upgrade $http_upgrade; 
proxy_set_header Connection 'upgrade'; 
proxy_set_header Host $host; 
proxy_cache_bypass $http_upgrade;
`
