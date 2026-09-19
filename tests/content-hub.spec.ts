import { test, expect } from '@playwright/test';
import { parseFeed } from '@/lib/content-hub/fetch';
import { extractArticle } from '@/lib/content-hub/extract';

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title><![CDATA[Blog Exemplo]]></title>
  <item>
    <title><![CDATA[What's new: <geolocation> &amp; more]]></title>
    <link>https://exemplo.com/a/</link>
    <dc:creator><![CDATA[Ana Souza]]></dc:creator>
    <category><![CDATA[CSS]]></category>
    <category><![CDATA[UX]]></category>
    <pubDate>Mon, 01 Sep 2026 10:00:00 +0000</pubDate>
    <description><![CDATA[<p>Resumo curto.</p>]]></description>
    <content:encoded><![CDATA[<p>Primeiro parágrafo.</p><p>Segundo &amp; último.</p><img src="https://exemplo.com/i.png"><p>The post X appeared first on Blog.</p>]]></content:encoded>
  </item>
  <item><title>Sem link</title></item>
</channel></rss>`;

test.describe('Content Hub parser', () => {
  test('unwraps CDATA and keeps titles that contain angle brackets', () => {
    const { title, items } = parseFeed(RSS);
    expect(title).toBe('Blog Exemplo');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("What's new: <geolocation> & more");
    expect(items[0].author).toBe('Ana Souza');
    expect(items[0].tags).toEqual(['CSS', 'UX']);
    expect(items[0].imageUrl).toBe('https://exemplo.com/i.png');
  });

  test('turns HTML into plain paragraphs without leaking markup or boilerplate', () => {
    const [item] = parseFeed(RSS).items;
    expect(item.content).toBe('Primeiro parágrafo.\n\nSegundo & último.');
    expect(item.content).not.toContain('<');
    expect(item.content).not.toContain('appeared first on');
  });

  test('never emits markup from escaped HTML in descriptions', () => {
    const xml = `<rss><channel><item><title>x</title><link>https://a.com/x</link>
      <description>&lt;script&gt;alert(1)&lt;/script&gt;&lt;p&gt;texto&lt;/p&gt;</description></item></channel></rss>`;
    const [item] = parseFeed(xml).items;
    expect(item.content).not.toMatch(/script|alert/);
    expect(item.content).toBe('texto');
  });

  test('parses Atom entries with alternate links', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Blog</title>
      <entry><title>Post</title><link rel="self" href="https://a.com/self"/><link rel="alternate" href="https://a.com/post"/>
      <published>2026-09-01T10:00:00Z</published><author><name>Bia</name></author>
      <content type="html">&lt;p&gt;Olá&lt;/p&gt;</content></entry></feed>`;
    const { title, items } = parseFeed(xml);
    expect(title).toBe('Atom Blog');
    expect(items[0].url).toBe('https://a.com/post');
    expect(items[0].author).toBe('Bia');
    expect(items[0].content).toBe('Olá');
  });
});

test.describe('Content Hub article extraction', () => {
  const prose = (n: number) => `Este é o parágrafo ${n}, longo o bastante para contar como texto de artigo de verdade. `.repeat(3);

  test('extracts prose from <article> and drops nav, link lists and noise', () => {
    const html = `<html><body><nav><p>${prose(0)}</p></nav>
      <article><h2>Título da seção</h2><p>${prose(1)}</p>
      <p><a href="/x">${'link '.repeat(20)}</a></p><p>Subscribe to our newsletter today please friends</p>
      <p>${prose(2)}</p></article><footer><p>${prose(3)}</p></footer></body></html>`;
    const out = extractArticle(html);
    expect(out).toContain('Título da seção');
    expect(out.split('\n\n').filter(b => b.startsWith('Este é'))).toHaveLength(2);
    expect(out).not.toContain('link link');
    expect(out).not.toContain('Subscribe');
  });

  test('returns empty when the page is not article-like', () => {
    expect(extractArticle('<html><body><p>curto</p></body></html>')).toBe('');
  });
});
