const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs-extra");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

function sanitizeFilename(name){
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

async function fetchDatabasePages(databaseId){
  const pages = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({ database_id: databaseId, start_cursor: cursor });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while(cursor);
  return pages;
}

async function pageToMarkdown(pageId){
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const md = n2m.toMarkdownString(mdBlocks);
  return md;
}

async function run(){
  const pageIdEnv = process.env.NOTION_PAGE_ID;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if(!pageIdEnv && !databaseId){
    console.error('Environment variable NOTION_PAGE_ID or NOTION_DATABASE_ID is required.');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'notion-content');
  await fs.ensureDir(outDir);

  if(pageIdEnv){
    // Normalize page id (accept with or without dashes)
    const pageId = pageIdEnv.replace(/[^a-fA-F0-9]/g, '');
    console.log('Syncing single Notion page:', pageIdEnv);
    try{
      const p = await notion.pages.retrieve({ page_id: pageId });
      const props = p.properties || {};
      const titleProp = (props.Name && props.Name.title && props.Name.title[0] && props.Name.title[0].plain_text)
        || (props.Title && props.Title.title && props.Title.title[0] && props.Title.title[0].plain_text)
        || `page-${pageId}`;
      const filename = sanitizeFilename(titleProp) + '.md';
      const filepath = path.join(outDir, filename);
      const md = await pageToMarkdown(pageId);
      const lastEdited = p.last_edited_time || p.created_time || '';
      const frontmatter = `---\ntitle: "${titleProp.replace(/"/g, '\\"')}"\nnotion_id: "${pageIdEnv}"\nlast_edited: "${lastEdited}"\n---\n\n`;
      await fs.writeFile(filepath, frontmatter + md, 'utf8');
      console.log('Wrote', filepath);
    }catch(err){
      console.error('Failed to convert page', pageIdEnv, err.message || err);
      process.exit(1);
    }
    return;
  }

  // Fallback: database sync
  console.log('Fetching pages from Notion database:', databaseId);
  const pages = await fetchDatabasePages(databaseId);
  console.log(`Found ${pages.length} pages`);

  for(const p of pages){
    const props = p.properties || {};
    const titleProp = (props.Name && props.Name.title && props.Name.title[0] && props.Name.title[0].plain_text)
      || (props.Title && props.Title.title && props.Title.title[0] && props.Title.title[0].plain_text)
      || `page-${p.id}`;

    const filename = sanitizeFilename(titleProp) + '.md';
    const filepath = path.join(outDir, filename);

    try{
      const md = await pageToMarkdown(p.id);
      const lastEdited = p.last_edited_time || p.created_time || '';
      const frontmatter = `---\ntitle: "${titleProp.replace(/"/g, '\\"')}"\nnotion_id: "${p.id}"\nlast_edited: "${lastEdited}"\n---\n\n`;
      await fs.writeFile(filepath, frontmatter + md, 'utf8');
      console.log('Wrote', filepath);
    }catch(err){
      console.error('Failed to convert page', p.id, err.message || err);
    }
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
