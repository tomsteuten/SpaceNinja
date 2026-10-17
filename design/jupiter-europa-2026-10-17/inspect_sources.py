"""Read only the explicitly supplied official source pages; no search or crawling."""
import json
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.links = []
        self.meta = {}
        self.href = None
        self.label = []
        self.skip = 0
        self.started = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'):
            self.skip += 1
        if tag == 'h1':
            self.started = True
        if tag == 'meta':
            self.meta[a.get('property', a.get('name', ''))] = a.get('content', '')
        if tag == 'a':
            self.href = a.get('href')
            self.label = []

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
        if tag == 'a' and self.href:
            self.links.append({'url': self.href, 'label': ' '.join(self.label)})
            self.href = None

    def handle_data(self, data):
        if self.skip or not data.strip():
            return
        if self.started:
            self.text.append(data.strip())
        if self.href:
            self.label.append(data.strip())


def inspect(url):
    # The system HTTPS client honours the host's managed trust configuration.
    # TLS validation stays enabled; no insecure fallback is used.
    response = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                               '--max-time', '45', '--write-out', '\n%{url_effective}', url],
                              check=True, capture_output=True).stdout.decode('utf-8', errors='replace')
    html, resolved = response.rsplit('\n', 1)
    page = Page()
    page.feed(html)
    text = '\n'.join(page.text)
    for end in ('Keep Exploring', 'Explore More', 'Related Topics'):
        text = text.split(end)[0]
    return {'requested_url': url, 'resolved_url': resolved,
            'title': page.meta.get('og:title'), 'text': text[:6500],
            'downloads': [{**link, 'url': urljoin(resolved, link['url'])} for link in page.links
                          if any(s in link['url'].lower() for s in ('.jpg', '.jpeg', '.png', '.tif', '.glb', '.zip'))],
            'preview': page.meta.get('og:image')}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    for url in sys.argv[1:]:
        try:
            print(json.dumps(inspect(url), ensure_ascii=False))
        except Exception as error:
            print(json.dumps({'url': url, 'error': str(error)}))
