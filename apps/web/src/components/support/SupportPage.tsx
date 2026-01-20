/**
 * SupportPage - Full page support view
 *
 * Contains three sections:
 * - Tickets: Create and view support tickets
 * - Legal: Legal documents (Terms, Privacy, Cookies, Payment)
 * - About: Company information
 */

import type { JSX } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import type { TicketCategory } from '../../api/supportTickets.js';
import {
  showSupportPage,
  activeSupportSection,
  activeLegalTab,
  tickets,
  ticketsLoading,
  selectedTicketId,
  selectedTicket,
  selectedTicketLoading,
  createTicketLoading,
  replyLoading,
  supportError,
  supportSuccess,
  hasMoreTickets,
  closeSupportPage,
  setSupportSection,
  setLegalTab,
  loadMoreTickets,
  selectTicket,
  clearSelectedTicket,
  submitTicket,
  sendTicketResponse,
  closeSelectedTicket,
  clearSupportError,
  clearSupportSuccess,
} from '../../state/support.signals.js';
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  COOKIE_POLICY,
  PAYMENT_TERMS,
} from '../../content/legal/index.js';
import { ABOUT_US } from '../../content/company/aboutUs.js';
import styles from './SupportPage.module.css';

// Category icons
const CATEGORY_ICONS: Record<TicketCategory, string> = {
  BUG_REPORT: '🐛',
  ACCOUNT_ISSUE: '👤',
  PAYMENT: '💳',
  OTHER: '💬',
};

// Status icons
const STATUS_ICONS: Record<string, string> = {
  OPEN: '🔴',
  IN_PROGRESS: '🟡',
  RESOLVED: '🟢',
  CLOSED: '⚫',
};

export function SupportPage(): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const isVisible = showSupportPage.value;
  const section = activeSupportSection.value;
  const legalTab = activeLegalTab.value;
  const ticketList = tickets.value;
  const loading = ticketsLoading.value;
  const currentTicketId = selectedTicketId.value;
  const currentTicket = selectedTicket.value;
  const ticketLoading = selectedTicketLoading.value;
  const creating = createTicketLoading.value;
  const replying = replyLoading.value;
  const error = supportError.value;
  const success = supportSuccess.value;
  const canLoadMore = hasMoreTickets.value;

  // Form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [formCategory, setFormCategory] = useState<TicketCategory | null>(null);
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [replyContent, setReplyContent] = useState('');

  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  // Clear form when closing
  useEffect(() => {
    if (!isVisible) {
      setShowNewForm(false);
      setFormCategory(null);
      setFormSubject('');
      setFormDescription('');
      setReplyContent('');
    }
  }, [isVisible]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => clearSupportSuccess(), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [success]);

  const handleBack = useCallback(() => {
    closeSupportPage();
  }, []);

  const handleSubmitTicket = useCallback(async (e: Event) => {
    e.preventDefault();
    if (!formCategory || !formSubject.trim() || !formDescription.trim()) return;

    const submitted = await submitTicket(formCategory, formSubject.trim(), formDescription.trim());
    if (submitted) {
      setShowNewForm(false);
      setFormCategory(null);
      setFormSubject('');
      setFormDescription('');
    }
  }, [formCategory, formSubject, formDescription]);

  const handleSendReply = useCallback(async (e: Event) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    const sent = await sendTicketResponse(replyContent.trim());
    if (sent) {
      setReplyContent('');
    }
  }, [replyContent]);

  const handleCloseTicket = useCallback(async () => {
    if (confirm(t('support.tickets.closeConfirm'))) {
      await closeSelectedTicket();
    }
  }, [t]);

  const handleStartNewTicket = useCallback(() => {
    setShowNewForm(true);
    clearSelectedTicket();
  }, []);

  const handleCancelNewTicket = useCallback(() => {
    setShowNewForm(false);
    setFormCategory(null);
    setFormSubject('');
    setFormDescription('');
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return t('messages.yesterday');
    } else if (days < 7) {
      return `${days}d`;
    } else {
      return date.toLocaleDateString(lang);
    }
  }, [lang, t]);

  if (!isVisible) return null;

  // Get legal content based on tab
  const getLegalContent = () => {
    switch (legalTab) {
      case 'terms':
        return TERMS_OF_SERVICE[lang];
      case 'privacy':
        return PRIVACY_POLICY[lang];
      case 'cookies':
        return COOKIE_POLICY[lang];
      case 'payment':
        return PAYMENT_TERMS[lang];
      default:
        return TERMS_OF_SERVICE[lang];
    }
  };

  const legalContent = getLegalContent();
  const aboutContent = ABOUT_US[lang];

  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        {/* Sidebar */}
        <aside class={styles.sidebar}>
          <button class={styles.backButton} onClick={handleBack}>
            <span class={styles.backIcon}>←</span>
            <span>{t('support.backToGame')}</span>
          </button>

          <h1 class={styles.pageTitle}>
            <span class={styles.titleIcon}>🎫</span>
            {t('support.title')}
          </h1>

          <nav class={styles.nav}>
            <button
              class={`${styles.navItem} ${section === 'tickets' ? styles.navItemActive : ''}`}
              onClick={() => setSupportSection('tickets')}
            >
              <span class={styles.navIcon}>📝</span>
              {t('support.sections.tickets')}
            </button>
            <button
              class={`${styles.navItem} ${section === 'legal' ? styles.navItemActive : ''}`}
              onClick={() => setSupportSection('legal')}
            >
              <span class={styles.navIcon}>📜</span>
              {t('support.sections.legal')}
            </button>
            <button
              class={`${styles.navItem} ${section === 'about' ? styles.navItemActive : ''}`}
              onClick={() => setSupportSection('about')}
            >
              <span class={styles.navIcon}>🏢</span>
              {t('support.sections.about')}
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main class={styles.mainContent}>
          {/* Error/Success messages */}
          {error && (
            <div class={styles.errorMessage} onClick={clearSupportError}>
              {error}
            </div>
          )}
          {success && (
            <div class={styles.successMessage}>
              {success}
            </div>
          )}

          {/* Tickets Section */}
          {section === 'tickets' && (
            <div class={styles.ticketsSection}>
              {showNewForm ? (
                <NewTicketForm
                  category={formCategory}
                  subject={formSubject}
                  description={formDescription}
                  loading={creating}
                  onCategoryChange={setFormCategory}
                  onSubjectChange={setFormSubject}
                  onDescriptionChange={setFormDescription}
                  onSubmit={handleSubmitTicket}
                  onCancel={handleCancelNewTicket}
                  t={t}
                />
              ) : (
                <div class={styles.ticketsContainer}>
                  {/* Tickets List */}
                  <div class={styles.ticketsList}>
                    <div class={styles.ticketsHeader}>
                      <h2 class={styles.ticketsTitle}>{t('support.tickets.myTickets')}</h2>
                      <button class={styles.newTicketBtn} onClick={handleStartNewTicket}>
                        + {t('support.tickets.newTicket')}
                      </button>
                    </div>

                    <div class={styles.ticketsScrollArea}>
                      {loading && ticketList.length === 0 ? (
                        <div class={styles.loading}>{t('support.tickets.loading')}</div>
                      ) : ticketList.length === 0 ? (
                        <div class={styles.noTickets}>
                          <div class={styles.noTicketsIcon}>📭</div>
                          <p class={styles.noTicketsText}>{t('support.tickets.noTickets')}</p>
                          <p class={styles.noTicketsText}>{t('support.tickets.noTicketsDesc')}</p>
                        </div>
                      ) : (
                        <>
                          {ticketList.map((ticket) => (
                            <div
                              key={ticket.id}
                              class={`${styles.ticketCard} ${currentTicketId === ticket.id ? styles.ticketCardSelected : ''}`}
                              onClick={() => selectTicket(ticket.id)}
                            >
                              <div class={styles.ticketCardHeader}>
                                <h3 class={styles.ticketSubject}>{ticket.subject}</h3>
                                <span class={`${styles.statusBadge} ${styles[`status${ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase().replace('_', '')}`]}`}>
                                  {STATUS_ICONS[ticket.status]} {t(`support.status.${ticket.status}`)}
                                </span>
                              </div>
                              <div class={styles.ticketMeta}>
                                <span class={styles.categoryBadge}>
                                  {CATEGORY_ICONS[ticket.category]} {t(`support.categories.${ticket.category}`)}
                                </span>
                                <span class={styles.ticketDate}>{formatDate(ticket.createdAt)}</span>
                                {ticket._count?.responses ? (
                                  <span class={styles.ticketResponseCount}>
                                    💬 {ticket._count.responses}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                          {canLoadMore && (
                            <button class={styles.loadMoreBtn} onClick={loadMoreTickets} disabled={loading}>
                              {loading ? '...' : t('support.tickets.loadMore')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ticket Detail */}
                  <div class={styles.ticketDetail}>
                    {ticketLoading ? (
                      <div class={styles.loading}>{t('labels.loading')}</div>
                    ) : currentTicket ? (
                      <>
                        <div class={styles.ticketDetailHeader}>
                          <h2 class={styles.ticketDetailTitle}>{currentTicket.subject}</h2>
                          <div class={styles.ticketDetailMeta}>
                            <span class={`${styles.statusBadge} ${styles[`status${currentTicket.status.charAt(0) + currentTicket.status.slice(1).toLowerCase().replace('_', '')}`]}`}>
                              {STATUS_ICONS[currentTicket.status]} {t(`support.status.${currentTicket.status}`)}
                            </span>
                            <span class={styles.categoryBadge}>
                              {CATEGORY_ICONS[currentTicket.category]} {t(`support.categories.${currentTicket.category}`)}
                            </span>
                            <span class={styles.ticketDate}>
                              {t('support.tickets.created')}: {formatDate(currentTicket.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div class={styles.ticketDetailDescription}>
                          <div class={styles.descriptionLabel}>{t('support.form.description')}</div>
                          <p class={styles.descriptionText}>{currentTicket.description}</p>
                        </div>

                        <div class={styles.ticketResponses}>
                          {currentTicket.responses && currentTicket.responses.length > 0 ? (
                            <>
                              <div class={styles.responsesLabel}>
                                💬 {currentTicket.responses.length} {t('support.tickets.responses')}
                              </div>
                              {currentTicket.responses.map((response) => (
                                <div
                                  key={response.id}
                                  class={`${styles.responseItem} ${response.isStaff ? styles.responseItemStaff : ''}`}
                                >
                                  <div class={styles.responseHeader}>
                                    <span class={`${styles.responseAuthor} ${response.isStaff ? styles.responseAuthorStaff : ''}`}>
                                      {response.isStaff ? `🛡️ ${t('support.tickets.staffResponse')}` : `👤 ${t('support.tickets.yourResponse')}`}
                                    </span>
                                    <span class={styles.responseDate}>{formatDate(response.createdAt)}</span>
                                  </div>
                                  <p class={styles.responseContent}>{response.content}</p>
                                </div>
                              ))}
                            </>
                          ) : null}
                        </div>

                        {currentTicket.status !== 'CLOSED' && (
                          <form class={styles.replyForm} onSubmit={handleSendReply}>
                            <textarea
                              class={styles.replyTextarea}
                              placeholder={t('support.tickets.replyPlaceholder')}
                              value={replyContent}
                              onInput={(e) => setReplyContent((e.target as HTMLTextAreaElement).value)}
                              maxLength={2000}
                            />
                            <div class={styles.replyActions}>
                              <button
                                type="button"
                                class={styles.closeTicketBtn}
                                onClick={handleCloseTicket}
                              >
                                {t('support.tickets.close')}
                              </button>
                              <button
                                type="submit"
                                class={styles.replyBtn}
                                disabled={!replyContent.trim() || replying}
                              >
                                {replying ? t('support.tickets.sending') : t('support.tickets.send')}
                              </button>
                            </div>
                          </form>
                        )}
                      </>
                    ) : (
                      <div class={styles.selectTicketPrompt}>
                        <div class={styles.selectTicketIcon}>📋</div>
                        <p class={styles.selectTicketText}>{t('support.tickets.selectTicket')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legal Section */}
          {section === 'legal' && (
            <div class={styles.legalSection}>
              <div class={styles.legalTabs}>
                <button
                  class={`${styles.legalTab} ${legalTab === 'terms' ? styles.legalTabActive : ''}`}
                  onClick={() => setLegalTab('terms')}
                >
                  {t('support.legal.tabs.terms')}
                </button>
                <button
                  class={`${styles.legalTab} ${legalTab === 'privacy' ? styles.legalTabActive : ''}`}
                  onClick={() => setLegalTab('privacy')}
                >
                  {t('support.legal.tabs.privacy')}
                </button>
                <button
                  class={`${styles.legalTab} ${legalTab === 'cookies' ? styles.legalTabActive : ''}`}
                  onClick={() => setLegalTab('cookies')}
                >
                  {t('support.legal.tabs.cookies')}
                </button>
                <button
                  class={`${styles.legalTab} ${legalTab === 'payment' ? styles.legalTabActive : ''}`}
                  onClick={() => setLegalTab('payment')}
                >
                  {t('support.legal.tabs.payment')}
                </button>
              </div>
              <div
                class={styles.legalContent}
                dangerouslySetInnerHTML={{ __html: legalContent.content }}
              />
            </div>
          )}

          {/* About Section */}
          {section === 'about' && (
            <div class={styles.aboutSection}>
              <div class={styles.aboutCard}>
                <div class={styles.aboutLogo}>
                  <div class={styles.aboutLogoIcon}>🏰</div>
                  <h2 class={styles.aboutGameName}>{aboutContent.gameName}</h2>
                  <p class={styles.aboutDescription}>{aboutContent.description}</p>
                </div>

                <div class={styles.aboutDivider} />

                <div class={styles.aboutSectionTitle}>{t('support.about.contact')}</div>
                <div class={styles.aboutInfoRow}>
                  <span class={styles.aboutInfoIcon}>📧</span>
                  <div>
                    <div class={styles.aboutInfoLabel}>{t('support.about.email')}</div>
                    <div class={styles.aboutInfoValue}>{aboutContent.email}</div>
                  </div>
                </div>

                <div class={styles.aboutDivider} />

                <div class={styles.aboutSectionTitle}>{t('support.about.companyInfo')}</div>
                <div class={styles.aboutInfoRow}>
                  <span class={styles.aboutInfoIcon}>🏢</span>
                  <div>
                    <div class={styles.aboutInfoValue}>{aboutContent.companyName}</div>
                  </div>
                </div>
                <div class={styles.aboutInfoRow}>
                  <span class={styles.aboutInfoIcon}>📍</span>
                  <div>
                    <div class={styles.aboutInfoLabel}>{t('support.about.address')}</div>
                    <div class={styles.aboutInfoValue}>
                      {aboutContent.address.street}<br />
                      {aboutContent.address.city}<br />
                      {aboutContent.address.country}
                    </div>
                  </div>
                </div>
                <div class={styles.aboutInfoRow}>
                  <span class={styles.aboutInfoIcon}>🔢</span>
                  <div>
                    <div class={styles.aboutInfoLabel}>NIP</div>
                    <div class={styles.aboutInfoValue}>{aboutContent.nip}</div>
                  </div>
                </div>
                <div class={styles.aboutInfoRow}>
                  <span class={styles.aboutInfoIcon}>📋</span>
                  <div>
                    <div class={styles.aboutInfoLabel}>REGON</div>
                    <div class={styles.aboutInfoValue}>{aboutContent.regon}</div>
                  </div>
                </div>

                <p class={styles.aboutCopyright}>
                  © {new Date().getFullYear()} {aboutContent.companyName}. {t('support.about.copyright')}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// New Ticket Form Component
interface NewTicketFormProps {
  category: TicketCategory | null;
  subject: string;
  description: string;
  loading: boolean;
  onCategoryChange: (cat: TicketCategory) => void;
  onSubjectChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onSubmit: (e: Event) => void;
  onCancel: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function NewTicketForm({
  category,
  subject,
  description,
  loading,
  onCategoryChange,
  onSubjectChange,
  onDescriptionChange,
  onSubmit,
  onCancel,
  t,
}: NewTicketFormProps): JSX.Element {
  const categories: TicketCategory[] = ['BUG_REPORT', 'ACCOUNT_ISSUE', 'PAYMENT', 'OTHER'];

  return (
    <form class={styles.newTicketForm} onSubmit={onSubmit}>
      <h2 class={styles.formTitle}>{t('support.tickets.newTicket')}</h2>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>{t('support.form.category')}</label>
        <div class={styles.categoryTiles}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              class={`${styles.categoryTile} ${category === cat ? styles.categoryTileSelected : ''}`}
              onClick={() => onCategoryChange(cat)}
            >
              <div class={styles.categoryTileIcon}>{CATEGORY_ICONS[cat]}</div>
              <div class={styles.categoryTileName}>{t(`support.categories.${cat}`)}</div>
              <div class={styles.categoryTileDesc}>{t(`support.categoryDescriptions.${cat}`)}</div>
            </button>
          ))}
        </div>
      </div>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>{t('support.form.subject')}</label>
        <input
          type="text"
          class={styles.formInput}
          placeholder={t('support.form.subjectPlaceholder')}
          value={subject}
          onInput={(e) => onSubjectChange((e.target as HTMLInputElement).value)}
          maxLength={200}
        />
        <div class={`${styles.charCount} ${subject.length > 200 ? styles.charCountOver : ''}`}>
          {t('support.form.charCount', { current: subject.length, max: 200 })}
        </div>
      </div>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>{t('support.form.description')}</label>
        <textarea
          class={styles.formTextarea}
          placeholder={t('support.form.descriptionPlaceholder')}
          value={description}
          onInput={(e) => onDescriptionChange((e.target as HTMLTextAreaElement).value)}
          maxLength={2000}
        />
        <div class={`${styles.charCount} ${description.length > 2000 ? styles.charCountOver : ''}`}>
          {t('support.form.charCount', { current: description.length, max: 2000 })}
        </div>
      </div>

      <div class={styles.formActions}>
        <button type="button" class={styles.cancelFormBtn} onClick={onCancel}>
          {t('buttons.cancel')}
        </button>
        <button
          type="submit"
          class={styles.submitBtn}
          disabled={!category || !subject.trim() || !description.trim() || loading}
        >
          {loading ? t('support.form.submitting') : t('support.form.submit')}
        </button>
      </div>
    </form>
  );
}

export default SupportPage;
