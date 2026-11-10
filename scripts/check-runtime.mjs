const [major,minor]=process.versions.node.split('.').map(Number);
if(!(major===22&&minor>=13||major>=24)){
 console.error('FOUND requires Node.js 24 (recommended), or Node.js 22.13+ on the 22.x line. Run nvm install && nvm use. The recovery store uses node:sqlite.');
 process.exit(1);
}
