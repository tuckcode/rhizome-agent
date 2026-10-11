const {chromium}=require('/workspace/a11ytool/node_modules/playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:640}});
for (const [f,o,fp] of [['index-dark-warm.html','compare-dark-warm.png',true],['index.html','compare.png',false]]){await p.setViewportSize({width:1600,height:fp?640:1000});await p.goto('file:///workspace/critiques/palette-earth/'+f,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:'/workspace/critiques/palette-earth/'+o,fullPage:fp});}
await b.close()})()
