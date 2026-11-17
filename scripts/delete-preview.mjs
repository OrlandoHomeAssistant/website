// Only this site's named, disposable PR previews may be removed.
export async function deletePreview(pr,env=process.env,request=fetch) {
 if (!/^[1-9][0-9]{0,8}$/.test(String(pr))) throw new Error('Invalid PR number');
 if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID || '') || !env.CLOUDFLARE_API_TOKEN) throw new Error('Missing Cloudflare credentials');
 const url=`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/workers/orlando-home-assistant-dev/previews/pr-${pr}`;
 const response=await request(url,{method:'DELETE',headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`}});
 if (response.status===404) return false; // No deployment, or a repeated close event.
 if (!response.ok || (await response.json()).success!==true) throw new Error(`Preview cleanup failed (HTTP ${response.status})`);
 return true;
}
if (import.meta.main) {
 const removed=await deletePreview(process.argv[2]);
 console.log(removed?'PR preview deleted.':'PR preview is already absent.');
}
