import { memo, useMemo, type MouseEvent, type ReactNode } from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { preprocessWikilinks, WIKILINK_SCHEME } from '../utils/chatWikilinks'
import { supportsModernRegexFeatures } from '../utils/regexCapabilities'
import { openExternalUrl } from '../utils/url'

const MODERN_REGEX_AVAILABLE = supportsModernRegexFeatures()
const REMARK_PLUGINS = MODERN_REGEX_AVAILABLE ? [remarkGfm] : []
const REHYPE_PLUGINS = MODERN_REGEX_AVAILABLE ? [rehypeHighlight] : []

function wikilinkUrlTransform(url: string): string {
  if (url.startsWith(WIKILINK_SCHEME)) return url
  return defaultUrlTransform(url)
}

function isExplicitWebUrl(href?: string): href is string {
  const lowerHref = href?.trim().toLowerCase() ?? ''
  return lowerHref.startsWith('http://') || lowerHref.startsWith('https://')
}

/**
 * Schemes the webview hands straight to the OS. These cannot strand the app,
 * so they stay plain anchors — making them inert would break mail and phone
 * links for no safety gain.
 */
const OS_HANDLED_SCHEMES = ['mailto:', 'tel:', 'sms:']

function isOsHandledScheme(href: string): boolean {
  const lowerHref = href.trim().toLowerCase()
  return OS_HANDLED_SCHEMES.some((scheme) => lowerHref.startsWith(scheme))
}

/**
 * `www.example.com` with no scheme. Deliberately narrower than "anything with
 * a dot": a relative note link like `notes/project.md` also parses as a bare
 * domain (`.md` is a real TLD), and silently opening a browser for someone's
 * note would be worse than leaving the link inert.
 */
function isSchemelessWebUrl(href: string): boolean {
  return href.trim().toLowerCase().startsWith('www.')
}

function openExplicitWebUrl(event: MouseEvent<HTMLAnchorElement>, href: string) {
  event.preventDefault()
  void openExternalUrl(href).catch((error) => {
    console.warn('[ai] Failed to open external link:', error)
  })
}

interface MarkdownContentProps {
  content: string
  onWikilinkClick?: (target: string) => void
}

export const MarkdownContent = memo(function MarkdownContent({ content, onWikilinkClick }: MarkdownContentProps) {
  const processedContent = useMemo(
    () => onWikilinkClick ? preprocessWikilinks(content) : content,
    [content, onWikilinkClick],
  )

  const components = useMemo(() => {
    return {
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        if (onWikilinkClick && href?.startsWith(WIKILINK_SCHEME)) {
          const target = decodeURIComponent(href.slice(WIKILINK_SCHEME.length))
          return (
            <a
              ref={(node) => {
                node?.setAttribute('role', 'link')
                node?.setAttribute('tabindex', '0')
              }}
              href={href}
              className="chat-wikilink border-0 bg-transparent p-0"
              data-wikilink-target={target}
              onClick={(event) => {
                event.preventDefault()
                onWikilinkClick(target)
              }}
            >
              {children}
            </a>
          )
        }
        if (href && (isExplicitWebUrl(href) || isSchemelessWebUrl(href))) {
          return <a href={href} onClick={(event) => openExplicitWebUrl(event, href)}>{children}</a>
        }
        if (href && isOsHandledScheme(href)) {
          return <a href={href}>{children}</a>
        }
        // Everything else is inert. The app renders in a webview with no
        // browser chrome, so any navigation away from it is a one-way trip:
        // no back button, no address bar, nothing to click but quit. An
        // unopenable link is a far smaller failure than a stranded app.
        return <a href={href} onClick={(event) => event.preventDefault()}>{children}</a>
      },
    }
  }, [onWikilinkClick])

  return (
    <div className="ai-markdown min-w-0 max-w-full overflow-hidden">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
        urlTransform={onWikilinkClick ? wikilinkUrlTransform : undefined}
      >
        {processedContent}
      </Markdown>
    </div>
  )
})
