import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function pwaBuild() {
  return {
    name: 'glasstodo-offline',
    enforce: 'post',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicFiles = readdirSync('public').filter(name => !name.startsWith('.'));
      const assets = [...Object.keys(bundle), ...publicFiles].sort();
      const hash = createHash('sha256');
      for (const name of assets) {
        const item = bundle[name];
        hash.update(name).update(item ? item.type === 'chunk' ? item.code : item.source : readFileSync(`public/${name}`));
      }
      const template = readFileSync('src/service-worker.js', 'utf8');
      hash.update(template);
      this.emitFile({type:'asset',fileName:'sw.js',source:template.replace('__VERSION__',hash.digest('hex').slice(0,16)).replace('__ASSETS__',JSON.stringify(assets))});
    },
  };
}
