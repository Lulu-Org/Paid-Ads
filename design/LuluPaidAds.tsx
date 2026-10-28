import { useState, type FormEvent } from 'react';
import './LuluPaidAds.css';
type Platform = 'All platforms' | 'Google Ads' | 'Google LSA' | 'Meta Ads' | 'LinkedIn Ads';
type CampaignStatus = 'Live' | 'Draft' | 'Paused';
type PlanStatus = 'done' | 'current' | 'upcoming';
type CampaignAsset = {
  name: string;
  type: string;
  meta: string;
  tone: string;
};
type Campaign = {
  name: string;
  platform: Exclude<Platform, 'All platforms'>;
  status: CampaignStatus;
  spend: string;
  budget: string;
  leads: string;
  cpl: string;
  progress: number;
  tone: string;
  objective: string;
  audience: string;
  schedule: string;
  rationale: string;
  nextStep: string;
  impressions: string;
  clicks: string;
  ctr: string;
  conversions: string;
  revenue: string;
  plan: {
    label: string;
    detail: string;
    status: PlanStatus;
  }[];
  assets: CampaignAsset[];
};
type UtilityModal = 'audience' | 'creative' | 'event' | 'automation' | 'connection' | 'report' | 'billing' | 'member' | 'policy' | 'payment' | 'scenario' | null;
const workspaceLinks = [{
  label: 'Online Presence',
  icon: '▦'
}, {
  label: 'Accounting',
  icon: '▤'
}, {
  label: 'Email',
  icon: '✉'
}, {
  label: 'Calendar',
  icon: '◷'
}, {
  label: 'CRM',
  icon: '♙'
}, {
  label: 'Time Tracking',
  icon: '◴'
}, {
  label: 'Architecture Studio',
  icon: '⌂'
}];
const campaigns: Campaign[] = [{
  name: 'Spring launch · Berlin',
  platform: 'Google Ads',
  status: 'Live',
  spend: '€4,280',
  budget: '€6,000',
  leads: '184',
  cpl: '€23.26',
  progress: 71,
  tone: 'violet',
  objective: 'Qualified lead generation',
  audience: 'Berlin · Decision makers · 25–54',
  schedule: '1 Jun – 30 Jun 2026',
  rationale: 'Search demand is strongest for high-intent terms around the spring launch. The campaign is connected to CRM attribution so lead quality can be reviewed beyond the click.',
  nextStep: 'Review search terms and shift 8% of spend into the two highest-converting ad groups.',
  impressions: '412.8k',
  clicks: '18.4k',
  ctr: '4.46%',
  conversions: '184',
  revenue: '€20,480',
  plan: [{
    label: 'Strategy approved',
    detail: 'Goal and attribution defined',
    status: 'done'
  }, {
    label: 'Audience and keywords',
    detail: '12 ad groups active',
    status: 'done'
  }, {
    label: 'Creative test',
    detail: 'Variant B is leading',
    status: 'current'
  }, {
    label: 'Budget review',
    detail: 'Next review in 3 days',
    status: 'upcoming'
  }, {
    label: 'Monthly report',
    detail: 'Due 30 Jun',
    status: 'upcoming'
  }],
  assets: [{
    name: 'Spring launch · Search RSA',
    type: 'Responsive search ad',
    meta: '4 headlines · 3 descriptions',
    tone: 'asset-violet'
  }, {
    name: 'Berlin landing page',
    type: 'Landing page',
    meta: 'Version 3 · 92% quality',
    tone: 'asset-blue'
  }, {
    name: 'Offer extension',
    type: 'Sitelink extension',
    meta: 'Used in 6 ad groups',
    tone: 'asset-mint'
  }]
}, {
  name: 'Local service calls',
  platform: 'Google LSA',
  status: 'Live',
  spend: '€1,940',
  budget: '€3,000',
  leads: '96',
  cpl: '€20.21',
  progress: 64,
  tone: 'blue',
  objective: 'Local phone calls',
  audience: 'Service area · 25 km radius',
  schedule: 'Always on · business hours',
  rationale: 'Local Services is producing reliable call volume in the service area. The current signal is stable, so the campaign is kept live while the lead response time is improved.',
  nextStep: 'Connect the missed-call workflow and compare booked jobs against raw calls.',
  impressions: '86.1k',
  clicks: '7.8k',
  ctr: '9.06%',
  conversions: '96',
  revenue: '€11,520',
  plan: [{
    label: 'Service area',
    detail: 'Berlin + 25 km',
    status: 'done'
  }, {
    label: 'Lead verification',
    detail: '96 calls reviewed',
    status: 'done'
  }, {
    label: 'Response workflow',
    detail: 'CRM handoff pending',
    status: 'current'
  }, {
    label: 'Quality review',
    detail: 'Next review in 5 days',
    status: 'upcoming'
  }],
  assets: [{
    name: 'Verified business profile',
    type: 'Local Services profile',
    meta: '4.9 rating · 38 reviews',
    tone: 'asset-blue'
  }, {
    name: 'Call script',
    type: 'Team playbook',
    meta: 'Used by 3 teammates',
    tone: 'asset-slate'
  }]
}, {
  name: 'Studio awareness',
  platform: 'Meta Ads',
  status: 'Live',
  spend: '€2,660',
  budget: '€4,500',
  leads: '231',
  cpl: '€11.52',
  progress: 59,
  tone: 'pink',
  objective: 'Awareness and lead capture',
  audience: 'Lookalike · Website visitors · 1%',
  schedule: '8 Jun – 8 Jul 2026',
  rationale: 'Meta is delivering the lowest cost per lead while the short-form creative receives strong engagement. The budget recommendation is based on qualified lead rate, not only volume.',
  nextStep: 'Scale the winning video concept by 12% and keep the control creative for comparison.',
  impressions: '628.4k',
  clicks: '31.7k',
  ctr: '5.04%',
  conversions: '231',
  revenue: '€18,920',
  plan: [{
    label: 'Audience build',
    detail: 'Lookalike refreshed',
    status: 'done'
  }, {
    label: 'Creative test',
    detail: 'Video concept A leads',
    status: 'done'
  }, {
    label: 'Budget scaling',
    detail: '12% recommendation',
    status: 'current'
  }, {
    label: 'Attribution check',
    detail: 'Review CRM quality',
    status: 'upcoming'
  }],
  assets: [{
    name: 'Studio walkthrough',
    type: 'Video · 15 sec',
    meta: 'Variant A · 91% completion',
    tone: 'asset-pink'
  }, {
    name: 'Before / after carousel',
    type: 'Carousel',
    meta: '6 cards · 3.8% saves',
    tone: 'asset-orange'
  }, {
    name: 'Lead form · Studio',
    type: 'Instant form',
    meta: '6 fields · CRM connected',
    tone: 'asset-mint'
  }]
}, {
  name: 'B2B pipeline · Q4',
  platform: 'LinkedIn Ads',
  status: 'Draft',
  spend: '€0',
  budget: '€2,500',
  leads: '—',
  cpl: '—',
  progress: 0,
  tone: 'slate',
  objective: 'B2B pipeline creation',
  audience: 'Operations leaders · DACH · 50–500 employees',
  schedule: 'Planned · 1 Oct – 31 Dec 2026',
  rationale: 'The draft is planned around the Q4 buying cycle and is waiting for final creative approval before launch.',
  nextStep: 'Approve the case study asset and define the CRM lead score threshold.',
  impressions: '—',
  clicks: '—',
  ctr: '—',
  conversions: '—',
  revenue: '—',
  plan: [{
    label: 'Campaign brief',
    detail: 'Goal and audience defined',
    status: 'done'
  }, {
    label: 'Creative approval',
    detail: 'Waiting on case study',
    status: 'current'
  }, {
    label: 'CRM scoring',
    detail: 'Threshold not set',
    status: 'upcoming'
  }, {
    label: 'Launch',
    detail: 'Planned for 1 Oct',
    status: 'upcoming'
  }],
  assets: [{
    name: 'Operations case study',
    type: 'PDF document',
    meta: 'Awaiting approval',
    tone: 'asset-slate'
  }, {
    name: 'Lead gen form',
    type: 'LinkedIn form',
    meta: 'Draft · 7 fields',
    tone: 'asset-blue'
  }]
}];
const platformCards = [{
  name: 'Google Ads',
  short: 'G',
  detail: 'Search, Display & YouTube',
  campaigns: '8 campaigns',
  color: 'google'
}, {
  name: 'Google LSA',
  short: 'L',
  detail: 'Local Services Ads',
  campaigns: '3 campaigns',
  color: 'lsa'
}, {
  name: 'Meta Ads',
  short: 'M',
  detail: 'Facebook & Instagram',
  campaigns: '6 campaigns',
  color: 'meta'
}, {
  name: 'LinkedIn Ads',
  short: 'in',
  detail: 'B2B audience campaigns',
  campaigns: '2 campaigns',
  color: 'linkedin'
}];
const paidAdViews = ['Overview', 'Campaigns', 'Planning', 'Audiences', 'Creatives', 'Tracking', 'Attribution & Data', 'Reports', 'Automations', 'Integrations', 'Platform Setup', 'Launch Checklist', 'Operations', 'Billing & Controls', 'Team & Permissions'];
const pageTitles: Record<string, string> = {
  Overview: 'Turn attention into growth.',
  Campaigns: 'Every campaign, clearly in view.',
  Planning: 'Plan spend before it happens.',
  Audiences: 'Build audiences that travel across channels.',
  Creatives: 'Create, compare and improve every creative.',
  Tracking: 'Know exactly what every click becomes.',
  'Attribution & Data': 'Connect business outcomes to every campaign.',
  Reports: 'Make every euro easier to understand.',
  Automations: 'Let the workspace watch the details.',
  Integrations: 'Keep every ad account connected.',
  'Platform Setup': 'Configure every channel without losing control.',
  'Launch Checklist': 'Validate every campaign before it goes live.',
  Operations: 'Keep syncs, webhooks and incidents visible.',
  'Billing & Controls': 'Keep spend and approvals under control.',
  'Team & Permissions': 'Give every teammate the right access.'
};
export const LuluPaidAds = () => {
  const [activeView, setActiveView] = useState('Overview');
  const [platform, setPlatform] = useState<Platform>('All platforms');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [utilityModal, setUtilityModal] = useState<UtilityModal>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [toast, setToast] = useState('');
  const [connected, setConnected] = useState<string[]>(['Google Ads', 'Google LSA', 'Meta Ads']);
  const [campaignRows, setCampaignRows] = useState<Campaign[]>(campaigns);
  const filteredCampaigns = platform === 'All platforms' ? campaignRows : campaignRows.filter(campaign => campaign.platform === platform);
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
    const modalTriggers: Array<[string, Exclude<UtilityModal, null>]> = [['New audience form opened', 'audience'], ['Upload creative form opened', 'creative'], ['Conversion event setup opened', 'event'], ['Report scheduled', 'report'], ['Custom report builder opened', 'report'], ['New automation rule opened', 'automation'], ['Spend limit editor opened', 'billing'], ['Approval policy editor opened', 'policy'], ['Payment methods opened', 'payment'], ['Invite teammate form opened', 'member'], ['Approval request sent', 'policy'], ['Planning scenario saved', 'scenario']];
    const triggered = modalTriggers.find(([needle]) => message.includes(needle));
    if (triggered) setUtilityModal(triggered[1]);
  }
  function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowCampaignModal(false);
    notify('Campaign draft saved.');
  }
  function connectPlatform(name: string) {
    if (!connected.includes(name)) setConnected(current => [...current, name]);
    setUtilityModal('connection');
  }
  function openUtilityModal(kind: Exclude<UtilityModal, null>) {
    setUtilityModal(kind);
  }
  function utilityModalCopy(kind: Exclude<UtilityModal, null>) {
    const copy: Record<Exclude<UtilityModal, null>, {
      eyebrow: string;
      title: string;
      description: string;
    }> = {
      audience: {
        eyebrow: 'NEW AUDIENCE',
        title: 'Build an audience that travels.',
        description: 'Choose a source, define consent and sync this audience to the channels that need it.'
      },
      creative: {
        eyebrow: 'NEW CREATIVE',
        title: 'Add an asset to the library.',
        description: 'Upload a creative, validate its formats and decide where it can be used.'
      },
      event: {
        eyebrow: 'CONVERSION EVENT',
        title: 'Define what counts as a result.',
        description: 'Map a business outcome to the sources and providers that should receive it.'
      },
      automation: {
        eyebrow: 'NEW AUTOMATION',
        title: 'Turn a signal into an action.',
        description: 'Set a trigger, condition and safe action. Sensitive budget changes require approval.'
      },
      connection: {
        eyebrow: 'CONNECT PROVIDER',
        title: 'Authorize an ad account.',
        description: 'Review permissions before the account is connected to your workspace.'
      },
      report: {
        eyebrow: 'NEW REPORT',
        title: 'Create a report your team can use.',
        description: 'Choose the view, comparison and delivery schedule.'
      },
      billing: {
        eyebrow: 'SPEND CONTROL',
        title: 'Protect the advertising budget.',
        description: 'Set limits, alerts and the approval threshold for changes.'
      },
      member: {
        eyebrow: 'INVITE TEAMMATE',
        title: 'Give someone the right access.',
        description: 'Choose a role and limit access to the channels or actions they need.'
      },
      policy: {
        eyebrow: 'APPROVAL POLICY',
        title: 'Make approvals explicit.',
        description: 'Define which spend, launch and creative changes require a second review.'
      },
      payment: {
        eyebrow: 'PAYMENT METHOD',
        title: 'Keep provider billing ready.',
        description: 'Add or update the payment method used by connected advertising accounts.'
      },
      scenario: {
        eyebrow: 'PLANNING SCENARIO',
        title: 'Model a different allocation.',
        description: 'Compare the expected impact before saving a new budget plan.'
      }
    };
    return copy[kind];
  }
  function renderUtilityModal() {
    if (!utilityModal) return null;
    const copy = utilityModalCopy(utilityModal);
    const save = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setUtilityModal(null);
      notify(`${copy.title} saved.`);
    };
    return <div className="ads-overlay" onMouseDown={event => event.target === event.currentTarget && setUtilityModal(null)}><section className="ads-utility-modal"><div className="ads-modal-head"><div><span className="ads-eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p></div><button className="ads-close" type="button" onClick={() => setUtilityModal(null)}>×</button></div><form className="ads-form" onSubmit={save}><div className="ads-utility-form-grid">{utilityModal === 'connection' && <><label><span>Provider</span><select defaultValue="Google Ads"><option>Google Ads</option><option>Google LSA</option><option>Meta Ads</option><option>LinkedIn Ads</option></select></label><label><span>Ad account ID</span><input placeholder="e.g. 123-456-7890" required /></label><div className="ads-permission-box"><strong>Requested permissions</strong><label><input type="checkbox" defaultChecked /> Read campaigns and performance</label><label><input type="checkbox" defaultChecked /> Manage ads and budgets</label><label><input type="checkbox" defaultChecked /> Sync audiences and conversions</label></div></>}{utilityModal === 'audience' && <><label><span>Audience name</span><input autoFocus placeholder="e.g. High-intent website visitors" required /></label><label><span>Source</span><select defaultValue="CRM qualified leads"><option>CRM qualified leads</option><option>Website visitors</option><option>Customer list upload</option><option>Purchase events</option></select></label><label><span>Sync destinations</span><select defaultValue="All connected channels"><option>All connected channels</option><option>Google Ads</option><option>Meta Ads</option><option>LinkedIn Ads</option></select></label><label className="ads-check-label"><input type="checkbox" defaultChecked /> Require valid consent before syncing</label></>}{utilityModal === 'creative' && <><label><span>Asset name</span><input autoFocus placeholder="e.g. Summer offer video" required /></label><label><span>Asset type</span><select defaultValue="Video"><option>Image</option><option>Video</option><option>Carousel</option><option>Responsive ad</option><option>Lead form</option></select></label><div className="ads-upload-box"><span>⇧</span><strong>Drop files here or choose from Media Library</strong><small>Validate dimensions, size and platform formats automatically.</small></div><label className="ads-check-label"><input type="checkbox" defaultChecked /> Run brand and policy validation</label></>}{utilityModal === 'event' && <><label><span>Event name</span><input autoFocus placeholder="e.g. Qualified lead" required /></label><label><span>Primary source</span><select defaultValue="CRM"><option>CRM</option><option>Website</option><option>Calendar</option><option>Accounting</option><option>Phone tracking</option></select></label><label><span>Value handling</span><select defaultValue="Use attributed revenue"><option>Use attributed revenue</option><option>Fixed value</option><option>No monetary value</option></select></label><label className="ads-check-label"><input type="checkbox" defaultChecked /> Deduplicate events across providers</label></>}{utilityModal === 'automation' && <><label><span>When</span><select defaultValue="CPL is above target for 3 days"><option>CPL is above target for 3 days</option><option>Tracking stops receiving events</option><option>Spend reaches 80% of budget</option><option>Ad is rejected</option></select></label><label><span>Then</span><select defaultValue="Request review and notify owner"><option>Request review and notify owner</option><option>Pause campaign</option><option>Shift budget with approval</option><option>Send team digest</option></select></label><label><span>Applies to</span><select defaultValue="All channels"><option>All channels</option><option>Google Ads</option><option>Meta Ads</option><option>LinkedIn Ads</option></select></label><label className="ads-check-label"><input type="checkbox" defaultChecked /> Require human approval for spend changes</label></>}{utilityModal === 'report' && <><label><span>Report name</span><input autoFocus placeholder="e.g. Weekly paid acquisition" required /></label><label><span>Break down by</span><select defaultValue="Channel and campaign"><option>Channel and campaign</option><option>Audience and creative</option><option>Location and device</option><option>Full funnel</option></select></label><label><span>Delivery</span><select defaultValue="Every Monday by email"><option>Every Monday by email</option><option>Monthly to the team</option><option>Save only</option></select></label></>}{utilityModal === 'member' && <><label><span>Email address</span><input autoFocus type="email" placeholder="teammate@company.com" required /></label><label><span>Role</span><select defaultValue="Editor"><option>Owner</option><option>Editor</option><option>Reviewer</option><option>Analyst</option></select></label><label><span>Channel scope</span><select defaultValue="All connected channels"><option>All connected channels</option><option>Google Ads only</option><option>Meta Ads only</option><option>Reports only</option></select></label><label className="ads-check-label"><input type="checkbox" defaultChecked /> Allow creative approvals</label></>}{utilityModal === 'billing' && <><label><span>Monthly workspace limit</span><input autoFocus defaultValue="€ 16,000" required /></label><label><span>Warning threshold</span><select defaultValue="80% of limit"><option>70% of limit</option><option>80% of limit</option><option>90% of limit</option></select></label><label><span>Approval threshold</span><input defaultValue="€ 2,500" required /></label><label className="ads-check-label"><input type="checkbox" defaultChecked /> Notify Finance before limit is reached</label></>}{utilityModal === 'policy' && <><label><span>Approval required for</span><select defaultValue="Budget and launch changes"><option>Budget and launch changes</option><option>All campaign changes</option><option>Creative changes only</option><option>Nothing</option></select></label><label><span>Approver role</span><select defaultValue="Finance reviewer"><option>Finance reviewer</option><option>Workspace owner</option><option>Marketing lead</option></select></label><label><span>Minimum change amount</span><input defaultValue="€ 2,500" required /></label></>}{utilityModal === 'payment' && <><label><span>Cardholder name</span><input autoFocus placeholder="Jamie Morgan" required /></label><label><span>Card number</span><input placeholder="•••• •••• •••• 2488" required /></label><div className="ads-form-grid"><label><span>Expiry</span><input placeholder="08 / 28" required /></label><label><span>CVC</span><input placeholder="•••" required /></label></div><label className="ads-check-label"><input type="checkbox" defaultChecked /> Use for connected provider accounts</label></>}{utilityModal === 'scenario' && <><label><span>Scenario name</span><input autoFocus placeholder="e.g. Shift 12% to Meta" required /></label><label><span>Budget movement</span><select defaultValue="Move from Google Ads to Meta Ads"><option>Move from Google Ads to Meta Ads</option><option>Increase all channels by 10%</option><option>Protect LinkedIn test budget</option></select></label><label><span>Forecast horizon</span><select defaultValue="Next 30 days"><option>Next 30 days</option><option>Next quarter</option></select></label></>}</div><div className="ads-form-note"><span>✦</span><p>Changes stay in draft until the required permissions, consent and approvals are complete.</p></div><div className="ads-modal-actions"><button className="ads-outline-button" type="button" onClick={() => setUtilityModal(null)}>Cancel</button><button className="ads-primary-button" type="submit">Save and continue</button></div></form></section></div>;
  }
  function toggleCampaign(name: string) {
    const current = campaignRows.find(campaign => campaign.name === name);
    const nextStatus: CampaignStatus = current?.status === 'Live' ? 'Paused' : 'Live';
    setCampaignRows(currentRows => currentRows.map(campaign => campaign.name === name ? {
      ...campaign,
      status: nextStatus
    } : campaign));
    setSelectedCampaign(currentSelected => currentSelected && currentSelected.name === name ? {
      ...currentSelected,
      status: nextStatus
    } : currentSelected);
    notify(`${name} ${nextStatus === 'Paused' ? 'paused' : 'resumed'}.`);
  }
  function renderCampaignTable() {
    return <section className="ads-card ads-campaign-card"><div className="ads-table-toolbar"><div className="ads-filter-pills"><button className={platform === 'All platforms' ? 'active' : ''} type="button" onClick={() => setPlatform('All platforms')}>All <b>19</b></button><button className={platform === 'Google Ads' ? 'active' : ''} type="button" onClick={() => setPlatform('Google Ads')}>Google Ads</button><button className={platform === 'Meta Ads' ? 'active' : ''} type="button" onClick={() => setPlatform('Meta Ads')}>Meta Ads</button><button type="button" onClick={() => notify('Filter options opened.')}>＋ Filter</button></div><button className="ads-icon-button" type="button" onClick={() => notify('Campaign report prepared.')}>⇩</button></div><div className="ads-table"><div className="ads-table-row ads-table-head"><span>CAMPAIGN</span><span>PLATFORM</span><span>STATUS</span><span>SPEND / BUDGET</span><span>LEADS</span><span>CPL</span><span /></div>{filteredCampaigns.map(campaign => <div className="ads-table-row" key={campaign.name}><button className="ads-campaign-name ads-campaign-link" type="button" onClick={() => setSelectedCampaign(campaign)}><i className={`campaign-dot ${campaign.tone}`} /><strong>{campaign.name}</strong><small>{campaign.progress ? `${campaign.progress}% of budget used` : 'Ready to launch'} · Open details</small></button><span><b className="platform-label">{campaign.platform}</b></span><span><b className={`status-pill ${campaign.status.toLowerCase()}`}>{campaign.status}</b></span><span className="spend-cell"><strong>{campaign.spend}</strong><small>{campaign.budget}</small><i><em style={{
                width: `${campaign.progress}%`
              }} /></i></span><span>{campaign.leads}</span><span>{campaign.cpl}</span><button className="ads-more" type="button" onClick={() => setSelectedCampaign(campaign)}>•••</button></div>)}</div></section>;
  }
  function renderOperationsPage() {
    return <><section className="ads-health-grid"><article className="ads-card ads-health-card"><span className="health-icon success">✓</span><div><span>Provider sync health</span><strong>Healthy</strong><small>4 providers · last sync 8 min ago</small></div></article><article className="ads-card ads-health-card"><span className="health-icon info">↻</span><div><span>Jobs processed today</span><strong>1,284</strong><small>99.6% completed successfully</small></div></article><article className="ads-card ads-health-card"><span className="health-icon warning">!</span><div><span>Needs attention</span><strong>2 incidents</strong><small>Retry or investigate below</small></div></article></section><section className="ads-operations-grid"><article className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">SYNC JOBS</span><h2>Every provider operation is observable.</h2><p>See direction, scope, timestamps and retry state before data changes again.</p></div><button className="ads-outline-button" type="button" onClick={() => notify('Sync jobs refreshed.')}>Refresh jobs</button></div><div className="ads-simple-table"><div><b>Provider</b><b>Operation</b><b>Direction</b><b>Status</b><b>Last run</b></div><div><span>Google Ads</span><span>Campaign performance</span><span>Provider → Lulu</span><span className="table-success">● Success</span><span>8 min ago</span></div><div><span>Meta Ads</span><span>Audience sync</span><span>Lulu ↔ Provider</span><span className="table-success">● Success</span><span>11 min ago</span></div><div><span>LinkedIn Ads</span><span>Conversion events</span><span>Lulu → Provider</span><span className="table-warning">● Retry queued</span><span>22 min ago</span></div></div></article><article className="ads-card ads-incident-card"><span className="ads-eyebrow">INCIDENTS AND RETRIES</span><h2>Nothing fails silently.</h2><div className="ads-incident"><span className="incident-mark warning">!</span><div><strong>LinkedIn offline conversion event</strong><small>Provider returned a temporary rate-limit response.</small><b>Retry in 4 minutes</b></div><button className="ads-text-button" type="button" onClick={() => notify('Retry requested for LinkedIn conversion event.')}>Retry</button></div><div className="ads-incident"><span className="incident-mark danger">×</span><div><strong>Meta audience refresh</strong><small>Consent mapping needs review before the next sync.</small><b>Action required</b></div><button className="ads-text-button" type="button" onClick={() => notify('Consent mapping opened.')}>Review</button></div></article></section><section className="ads-operations-grid"><article className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">WEBHOOK EVENTS</span><h2>Events received from providers.</h2></div><button className="ads-text-button" type="button" onClick={() => notify('Webhook log opened.')}>Full webhook log →</button></div><div className="ads-webhook-list"><div><span className="webhook-dot green" /><strong>campaign.updated</strong><small>Google Ads · Spring launch · 8 min ago</small></div><div><span className="webhook-dot green" /><strong>lead.created</strong><small>Meta Ads · Studio awareness · 12 min ago</small></div><div><span className="webhook-dot amber" /><strong>conversion.retrying</strong><small>LinkedIn Ads · B2B pipeline · 22 min ago</small></div></div></article><article className="ads-card ads-incident-card"><span className="ads-eyebrow">RECONCILIATION</span><h2>Compare provider and Lulu.</h2><p>Check whether spend, conversions and statuses match before closing the day.</p><div className="ads-reconciliation-score"><strong>98.4%</strong><span>records reconciled</span></div><button className="ads-primary-button" type="button" onClick={() => notify('Reconciliation run started.')}>Run reconciliation</button></article></section></>;
  }
  function renderAdvancedPage(view: string) {
    if (view === 'Attribution & Data') return <><section className="ads-health-grid"><article className="ads-card ads-health-card"><span className="health-icon success">✓</span><div><span>Data quality</span><strong>98.6%</strong><small>Events mapped to real outcomes</small></div></article><article className="ads-card ads-health-card"><span className="health-icon info">↗</span><div><span>Attributed revenue</span><strong>€42,640</strong><small>Across CRM and accounting</small></div></article><article className="ads-card ads-health-card"><span className="health-icon warning">!</span><div><span>Unmapped events</span><strong>2 events</strong><small>Review before next report</small></div></article></section><section className="ads-advanced-grid"><article className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">ATTRIBUTION MODEL</span><h2>Choose how value is assigned.</h2><p>Compare models before they affect your campaign decisions.</p></div><select defaultValue="Data-driven"><option>Data-driven</option><option>Last touch</option><option>First touch</option><option>Linear</option></select></div><div className="ads-attribution-bars"><div><span>Google Ads <b>€20,480</b></span><i><em style={{
                  width: '82%'
                }} /></i></div><div><span>Meta Ads <b>€18,920</b></span><i><em style={{
                  width: '76%'
                }} /></i></div><div><span>Google LSA <b>€11,520</b></span><i><em style={{
                  width: '52%'
                }} /></i></div></div></article><article className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">EVENT MAPPING</span><h2>Business outcomes, connected.</h2></div><button className="ads-primary-button" type="button" onClick={() => openUtilityModal('event')}>＋ Add event</button></div><div className="ads-simple-table"><div><b>Event</b><b>Source</b><b>Value</b><b>Health</b></div><div><span>Qualified lead</span><span>CRM</span><span>€120</span><span className="table-success">Mapped</span></div><div><span>Booked consultation</span><span>Calendar</span><span>€340</span><span className="table-success">Mapped</span></div><div><span>Offline sale</span><span>Accounting</span><span>Dynamic</span><span className="table-warning">Review</span></div></div></article></section><section className="ads-card ads-decision-card"><span className="ads-eyebrow">DATA LINEAGE</span><h2>Where the number came from.</h2><div className="ads-lineage"><span>Ad click</span><b>→</b><span>Website form</span><b>→</b><span>CRM lead</span><b>→</b><span>Calendar booking</span><b>→</b><strong>Revenue</strong></div><button className="ads-outline-button" type="button" onClick={() => notify('Attribution lineage opened.')}>Inspect lineage</button></section></>;
    if (view === 'Platform Setup') return <><section className="ads-section-heading"><div><span className="ads-eyebrow">PLATFORM SETUP</span><h2>Configure each channel with confidence.</h2><p className="ads-subcopy">Account, bidding, tracking and policy settings stay visible before launch.</p></div><button className="ads-outline-button" type="button" onClick={() => openUtilityModal('connection')}>＋ Connect provider</button></section><section className="ads-setup-grid">{['Google Ads', 'Google LSA', 'Meta Ads', 'LinkedIn Ads'].map((name, index) => <article className="ads-card ads-setup-card" key={name}><div className="ads-setup-head"><div className={`ads-platform-logo ${platformCards[index].color}`}>{platformCards[index].short}</div><div><h3>{name}</h3><span className="integration-status connected">Connected · 8 min ago</span></div></div><div className="ads-setup-list"><span><b>Account</b>{index === 0 ? 'Lulu Growth · 123-456' : index === 1 ? 'Lulu Berlin Local' : index === 2 ? 'Lulu Studio Business' : 'Lulu Intelligence Page'}</span><span><b>Tracking</b><em className="table-success">● Healthy</em></span><span><b>Permissions</b>Campaigns · Audiences · Conversions</span><span><b>Policy status</b><em className="table-success">✓ No issues</em></span></div><button className="ads-outline-button" type="button" onClick={() => openUtilityModal('connection')}>Configure channel</button></article>)}</section><section className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">DEFAULTS</span><h2>Guardrails applied to new campaigns.</h2></div><button className="ads-text-button" type="button" onClick={() => openUtilityModal('policy')}>Edit guardrails →</button></div><div className="ads-guardrail-grid"><span>Consent required <b>On</b></span><span>Approval above <b>€2,500</b></span><span>Auto-tag links <b>On</b></span><span>Policy validation <b>On</b></span></div></section></>;
    return <><section className="ads-checklist-header"><div><span className="ads-eyebrow">PRE-LAUNCH GOVERNANCE</span><h2>Every campaign passes the same safety checks.</h2><p className="ads-subcopy">Nothing launches until data, assets, permissions and approvals are ready.</p></div><div className="ads-checklist-score"><strong>8 / 10</strong><span>checks completed</span></div></section><section className="ads-card ads-launch-card"><div className="ads-launch-row done"><span>✓</span><div><strong>Ad account connected</strong><small>Google Ads account permissions reviewed</small></div><b>Complete</b></div><div className="ads-launch-row done"><span>✓</span><div><strong>Conversion event mapped</strong><small>Qualified lead is connected to CRM</small></div><b>Complete</b></div><div className="ads-launch-row done"><span>✓</span><div><strong>Audience consent checked</strong><small>All synced contacts have valid consent</small></div><b>Complete</b></div><div className="ads-launch-row warning"><span>!</span><div><strong>Creative policy review</strong><small>One asset still needs approval from Marketing</small></div><button className="ads-text-button" type="button" onClick={() => openUtilityModal('creative')}>Review</button></div><div className="ads-launch-row warning"><span>!</span><div><strong>Budget approval</strong><small>Finance review required above €2,500</small></div><button className="ads-text-button" type="button" onClick={() => openUtilityModal('policy')}>Request</button></div></section><section className="ads-card ads-decision-card"><span className="ads-eyebrow">LAUNCH DECISION</span><h2>What is blocking launch?</h2><div className="ads-decision-grid"><div><strong>Ready</strong><p>Tracking, account access and audience consent are ready.</p></div><div><strong>Needs review</strong><p>One creative and one Finance approval are still open.</p></div><div><strong>Next action</strong><p>Ask Marketing to approve the asset, then request Finance sign-off.</p></div></div><div className="ads-modal-actions"><button className="ads-outline-button" type="button" onClick={() => notify('Checklist shared with approvers.')}>Share checklist</button><button className="ads-primary-button" type="button" onClick={() => openUtilityModal('policy')}>Request approvals</button></div></section></>;
  }
  function renderSupportingPage() {
    if (activeView === 'Attribution & Data' || activeView === 'Platform Setup' || activeView === 'Launch Checklist') return renderAdvancedPage(activeView);
    if (activeView === 'Operations') return renderOperationsPage();
    if (activeView === 'Campaigns') return <><section className="ads-campaign-summary"><article><span>Active campaigns</span><strong>{campaignRows.filter(campaign => campaign.status === 'Live').length}</strong><small>Pause or resume from campaign details</small></article><article><span>Planned spend</span><strong>€16,000</strong><small>Across 4 channels</small></article><article><span>Assets in rotation</span><strong>11</strong><small>3 need review</small></article><article><span>Next review</span><strong>3 days</strong><small>Meta budget recommendation</small></article></section>{renderCampaignTable()}</>;
    if (activeView === 'Planning') return <><section className="ads-kpi-grid"><article className="ads-kpi-card"><span>Planned monthly spend</span><strong>€16,000</strong><small className="positive">74% allocated</small></article><article className="ads-kpi-card"><span>Target leads</span><strong>820</strong><small className="positive">+18% vs. last plan</small></article><article className="ads-kpi-card"><span>Forecast revenue</span><strong>€78.4k</strong><small className="positive">4.9x forecast ROAS</small></article><article className="ads-kpi-card"><span>Next planning review</span><strong>3 days</strong><small>Meta budget shift</small></article></section><section className="ads-planning-grid"><article className="ads-card ads-planning-card"><div className="ads-card-header"><div><span className="ads-eyebrow">BUDGET PLAN · JUNE 2026</span><h2>Allocate before the spend happens.</h2><p>Every channel has a target, owner and review point.</p></div><button className="ads-primary-button" type="button" onClick={() => notify('Planning scenario saved.')}>Save scenario</button></div><div className="ads-budget-bars"><div><span>Google Ads <b>€6,000</b></span><i><em style={{
                  width: '76%'
                }} /></i><small>38% of planned spend · target ROAS 4.5x</small></div><div><span>Google LSA <b>€3,000</b></span><i><em style={{
                  width: '52%'
                }} /></i><small>19% of planned spend · target CPL €22</small></div><div><span>Meta Ads <b>€4,500</b></span><i><em style={{
                  width: '68%'
                }} /></i><small>28% of planned spend · target CPL €14</small></div><div><span>LinkedIn Ads <b>€2,500</b></span><i><em style={{
                  width: '34%'
                }} /></i><small>15% of planned spend · target 80 qualified leads</small></div></div></article><article className="ads-card ads-plan-timeline"><span className="ads-eyebrow">PLANNING STEPS</span><h2>From brief to review.</h2><div className="ads-planning-timeline"><div className="done"><b>✓</b><span><strong>Set targets</strong><small>Goals confirmed by Jamie</small></span></div><div className="done"><b>✓</b><span><strong>Allocate budgets</strong><small>Four channels covered</small></span></div><div className="current"><b>•</b><span><strong>Approve scenario</strong><small>Waiting for finance owner</small></span></div><div><b>○</b><span><strong>Launch and monitor</strong><small>Starts after approval</small></span></div></div><button className="ads-outline-button" type="button" onClick={() => notify('Approval request sent to Finance.')}>Request approval</button></article></section><section className="ads-card ads-decision-card"><span className="ads-eyebrow">PLANNING LOGIC</span><h2>Why this plan looks this way.</h2><div className="ads-decision-grid"><div><strong>Goal</strong><p>Balance lead volume with qualified pipeline, not clicks alone.</p></div><div><strong>Constraint</strong><p>Keep monthly spend below €16,000 and require Finance approval above €2,500.</p></div><div><strong>Signal</strong><p>Meta currently has the strongest qualified-lead rate and can absorb a 12% shift.</p></div></div></section></>;
    if (activeView === 'Audiences') return <><section className="ads-section-heading"><div><span className="ads-eyebrow">AUDIENCE LIBRARY</span><h2>One audience, many channels.</h2><p className="ads-subcopy">Build, sync and exclude audiences while keeping consent and source visible.</p></div><button className="ads-primary-button" type="button" onClick={() => notify('New audience form opened.')}>＋ Create audience</button></section><section className="ads-audience-grid"><article className="ads-card ads-audience-card"><div className="ads-audience-top"><span className="audience-icon violet">♙</span><b>Synced</b></div><h3>Website visitors · 30 days</h3><p>Visitors from Lulu Online Presence</p><strong>42,810 <small>people</small></strong><div className="ads-audience-meta"><span>Match rate <b>82%</b></span><span>Used in <b>6 campaigns</b></span></div><button className="ads-outline-button" type="button" onClick={() => notify('Audience details opened.')}>View audience</button></article><article className="ads-card ads-audience-card"><div className="ads-audience-top"><span className="audience-icon blue">♧</span><b>Synced</b></div><h3>CRM · Qualified leads</h3><p>Contacts with an active sales stage</p><strong>8,420 <small>people</small></strong><div className="ads-audience-meta"><span>Match rate <b>76%</b></span><span>Used in <b>3 campaigns</b></span></div><button className="ads-outline-button" type="button" onClick={() => notify('Audience details opened.')}>View audience</button></article><article className="ads-card ads-audience-card"><div className="ads-audience-top"><span className="audience-icon mint">✦</span><b>Refreshing</b></div><h3>Lookalike · Studio buyers</h3><p>Modeled from 2,140 converted leads</p><strong>1.2m <small>estimated reach</small></strong><div className="ads-audience-meta"><span>Source <b>CRM</b></span><span>Used in <b>2 campaigns</b></span></div><button className="ads-outline-button" type="button" onClick={() => notify('Audience refresh scheduled.')}>Refresh now</button></article></section><section className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">AUDIENCE CONTROLS</span><h2>Sources, consent and exclusions.</h2></div><button className="ads-text-button" type="button" onClick={() => notify('Consent settings opened.')}>Privacy settings →</button></div><div className="ads-simple-table"><div><b>Source</b><b>Last sync</b><b>Consent</b><b>Exclusions</b><b /></div><div><span>CRM qualified leads</span><span>8 min ago</span><span className="table-success">✓ Valid</span><span>Existing customers</span><button className="ads-more" type="button" onClick={() => notify('Audience source actions opened.')}>•••</button></div><div><span>Website visitors</span><span>Yesterday</span><span className="table-success">✓ Valid</span><span>Employees</span><button className="ads-more" type="button" onClick={() => notify('Audience source actions opened.')}>•••</button></div></div></section></>;
    if (activeView === 'Creatives') return <><section className="ads-section-heading"><div><span className="ads-eyebrow">CREATIVE LIBRARY</span><h2>Every asset, version and result in context.</h2><p className="ads-subcopy">See where an asset is used, who approved it and which variant is winning.</p></div><button className="ads-primary-button" type="button" onClick={() => notify('Upload creative form opened.')}>＋ Add creative</button></section><section className="ads-creative-grid">{['Studio walkthrough', 'Spring launch · Search RSA', 'Before / after carousel', 'Operations case study', 'Offer extension', 'Lead form · Studio'].map((asset, index) => <button className="ads-card ads-creative-card" type="button" key={asset} onClick={() => notify(`${asset} details opened.`)}><div className={`ads-creative-preview creative-${index % 5}`}><span>{index === 0 ? '▶' : index === 3 ? 'PDF' : '✦'}</span><b>{index === 1 ? 'WINNER' : index === 3 ? 'REVIEW' : 'LIVE'}</b></div><div className="ads-creative-copy"><strong>{asset}</strong><small>{index % 2 === 0 ? 'Video / image asset' : 'Responsive asset'} · {index + 2} campaigns</small><span><i className="creative-status-dot" /> {index === 3 ? 'Needs approval' : 'Approved'} <em>···</em></span></div></button>)}</section><section className="ads-card ads-creative-test-card"><div className="ads-card-header"><div><span className="ads-eyebrow">CREATIVE TESTING</span><h2>Variant B is leading by 21%.</h2><p>Compare results using qualified conversions, not just engagement.</p></div><button className="ads-outline-button" type="button" onClick={() => notify('Creative comparison opened.')}>Compare variants</button></div><div className="ads-variant-row"><div><span>Variant A · Control</span><strong>€18.40 CPL</strong><i><em style={{
                width: '64%'
              }} /></i><small>184 qualified leads</small></div><div><span>Variant B · Winner</span><strong>€14.52 CPL</strong><i><em style={{
                width: '86%'
              }} /></i><small>231 qualified leads</small></div><div><span>Variant C · Learning</span><strong>€20.11 CPL</strong><i><em style={{
                width: '48%'
              }} /></i><small>82 qualified leads</small></div></div></section></>;
    if (activeView === 'Tracking') return <><section className="ads-health-grid"><article className="ads-card ads-health-card"><span className="health-icon success">✓</span><div><span>Tracking health</span><strong>Healthy</strong><small>All active channels receiving events</small></div></article><article className="ads-card ads-health-card"><span className="health-icon info">↗</span><div><span>Events today</span><strong>8,420</strong><small>+11.4% compared to yesterday</small></div></article><article className="ads-card ads-health-card"><span className="health-icon warning">!</span><div><span>Needs attention</span><strong>2 events</strong><small>Review offline conversion mapping</small></div></article></section><section className="ads-tracking-grid"><article className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">CONVERSION EVENTS</span><h2>What counts as a result.</h2></div><button className="ads-primary-button" type="button" onClick={() => notify('Conversion event setup opened.')}>＋ Add event</button></div><div className="ads-simple-table"><div><b>Event</b><b>Source</b><b>Last received</b><b>Status</b><b /></div><div><span>Qualified lead</span><span>CRM + Website</span><span>2 min ago</span><span className="table-success">● Healthy</span><button className="ads-more" type="button">•••</button></div><div><span>Booked consultation</span><span>Calendar</span><span>11 min ago</span><span className="table-success">● Healthy</span><button className="ads-more" type="button">•••</button></div><div><span>Offline sale</span><span>Accounting</span><span>Yesterday</span><span className="table-warning">● Review</span><button className="ads-more" type="button">•••</button></div></div></article><article className="ads-card ads-utm-card"><span className="ads-eyebrow">UTM BUILDER</span><h2>Keep every click attributable.</h2><label><span>Campaign</span><input value="spring_launch_berlin" readOnly /></label><label><span>Content</span><input value="search_rsa_b" readOnly /></label><div className="ads-utm-result">https://lulu.ai/?utm_source=google&utm_campaign=spring_launch_berlin&utm_content=search_rsa_b</div><button className="ads-outline-button" type="button" onClick={() => notify('Tracking link copied.')}>Copy tracking link</button></article></section></>;
    if (activeView === 'Reports') return <><section className="ads-report-toolbar"><div className="ads-filter-pills"><button className="active" type="button">Last 30 days</button><button type="button" onClick={() => notify('Date picker opened.')}>Custom range</button><button type="button" onClick={() => notify('Report filters opened.')}>＋ Filter</button></div><button className="ads-primary-button" type="button" onClick={() => notify('Report scheduled.')}>Schedule report</button></section><section className="ads-kpi-grid"><article className="ads-kpi-card"><span>Revenue attributed</span><strong>€42,640</strong><small className="positive">↗ 18.7%</small></article><article className="ads-kpi-card"><span>Qualified leads</span><strong>511</strong><small className="positive">↗ 9.2%</small></article><article className="ads-kpi-card"><span>Conversion rate</span><strong>3.8%</strong><small className="positive">↗ 0.6pp</small></article><article className="ads-kpi-card"><span>Cost per qualified lead</span><strong>€17.38</strong><small className="positive">↘ 8.1%</small></article></section><section className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">CHANNEL COMPARISON</span><h2>Compare what each channel contributes.</h2></div><button className="ads-outline-button" type="button" onClick={() => notify('Custom report builder opened.')}>Custom report</button></div><div className="ads-simple-table report-table"><div><b>Channel</b><b>Spend</b><b>Leads</b><b>Qualified</b><b>ROAS</b></div><div><span>Google Ads</span><span>€4,280</span><span>184</span><span>126</span><strong>4.8x</strong></div><div><span>Google LSA</span><span>€1,940</span><span>96</span><span>71</span><strong>5.9x</strong></div><div><span>Meta Ads</span><span>€2,660</span><span>231</span><span>184</span><strong>6.2x</strong></div><div><span>LinkedIn Ads</span><span>€0</span><span>—</span><span>—</span><strong>Draft</strong></div></div></section></>;
    if (activeView === 'Automations') return <><section className="ads-section-heading"><div><span className="ads-eyebrow">AUTOMATIONS AND ALERTS</span><h2>Let the workspace watch the details.</h2><p className="ads-subcopy">Rules can notify, recommend or pause campaigns when conditions are met.</p></div><button className="ads-primary-button" type="button" onClick={() => notify('New automation rule opened.')}>＋ Create rule</button></section><section className="ads-automation-grid"><article className="ads-card ads-rule-card"><div><span className="rule-icon violet">↗</span><span className="rule-status on">ON</span></div><h3>Protect target CPL</h3><p>When CPL is above €28 for 3 days, notify the campaign owner and request a budget review.</p><footer><span>Google Ads · Meta Ads</span><button className="ads-text-button" type="button" onClick={() => notify('Automation rule edited.')}>Edit</button></footer></article><article className="ads-card ads-rule-card"><div><span className="rule-icon blue">◷</span><span className="rule-status on">ON</span></div><h3>Weekly performance digest</h3><p>Every Monday, send channel comparison and attribution changes to the marketing team.</p><footer><span>Email · Jamie Morgan</span><button className="ads-text-button" type="button" onClick={() => notify('Automation rule edited.')}>Edit</button></footer></article><article className="ads-card ads-rule-card"><div><span className="rule-icon orange">!</span><span className="rule-status paused">PAUSED</span></div><h3>Pause on tracking failure</h3><p>Pause campaigns when no conversion event is received for 12 hours and create an incident.</p><footer><span>All channels</span><button className="ads-text-button" type="button" onClick={() => notify('Automation resumed.')}>Resume</button></footer></article></section><section className="ads-card ads-event-log"><span className="ads-eyebrow">RECENT AUTOMATION ACTIVITY</span><h2>Every automated decision is visible.</h2><div className="ads-simple-table"><div><b>Rule</b><b>Action</b><b>Campaign</b><b>Time</b></div><div><span>Protect target CPL</span><span>Review requested</span><span>Studio awareness</span><span>8 min ago</span></div><div><span>Weekly digest</span><span>Sent to team</span><span>All channels</span><span>Yesterday</span></div></div></section></>;
    if (activeView === 'Integrations') return <><section className="ads-section-heading"><div><span className="ads-eyebrow">AD PLATFORM CONNECTIONS</span><h2>Keep every ad account connected.</h2><p className="ads-subcopy">See permissions, sync health and the last successful data exchange.</p></div><button className="ads-outline-button" type="button" onClick={() => notify('Integration directory opened.')}>Browse integrations</button></section><section className="ads-integration-grid">{platformCards.map(card => <article className="ads-card ads-integration-card" key={card.name}><div className={`ads-platform-logo ${card.color}`}>{card.short}</div><div><h3>{card.name}<span className={connected.includes(card.name) ? 'integration-status connected' : 'integration-status'}>{connected.includes(card.name) ? 'Connected' : 'Not connected'}</span></h3><p>{card.detail}</p><div className="ads-permission-list"><span>Campaigns</span><span>Ads and assets</span><span>Performance data</span></div><small>{connected.includes(card.name) ? 'Last sync 8 min ago · Permissions reviewed' : 'Requires account authorization'}</small></div><button className={connected.includes(card.name) ? 'ads-quiet-button' : 'ads-primary-button'} type="button" onClick={() => connectPlatform(card.name)}>{connected.includes(card.name) ? 'Manage' : 'Connect'}</button></article>)}</section><section className="ads-card ads-sync-log"><div className="ads-card-header"><div><span className="ads-eyebrow">SYNC HISTORY</span><h2>Provider operations stay observable.</h2></div><button className="ads-text-button" type="button" onClick={() => notify('Full sync history opened.')}>View history →</button></div><div className="ads-sync-row"><span className="table-success">● Success</span><strong>Meta Ads</strong><span>Campaigns, audiences and spend</span><time>8 min ago</time></div><div className="ads-sync-row"><span className="table-success">● Success</span><strong>Google Ads</strong><span>Conversions and creative results</span><time>14 min ago</time></div></section></>;
    if (activeView === 'Billing & Controls') return <><section className="ads-control-grid"><article className="ads-card ads-control-card"><span className="ads-eyebrow">WORKSPACE SPEND LIMIT</span><strong>€16,000 <small>/ month</small></strong><div className="ads-limit-bar"><i><em style={{
                width: '55%'
              }} /></i><span>€8,880 used · €7,120 remaining</span></div><button className="ads-outline-button" type="button" onClick={() => notify('Spend limit editor opened.')}>Edit limit</button></article><article className="ads-card ads-control-card"><span className="ads-eyebrow">APPROVAL THRESHOLD</span><strong>€2,500 <small>per change</small></strong><p>Budget changes above this amount need Finance approval.</p><button className="ads-outline-button" type="button" onClick={() => notify('Approval policy editor opened.')}>Edit policy</button></article><article className="ads-card ads-control-card"><span className="ads-eyebrow">PAYMENT STATUS</span><strong>Active <small>Visa ···· 2488</small></strong><p>All connected ad accounts can spend.</p><button className="ads-outline-button" type="button" onClick={() => notify('Payment methods opened.')}>Manage payment</button></article></section><section className="ads-card ads-data-table-card"><div className="ads-card-header"><div><span className="ads-eyebrow">BILLING HISTORY</span><h2>Keep platform charges easy to review.</h2></div><button className="ads-text-button" type="button" onClick={() => notify('Billing invoices opened.')}>View invoices →</button></div><div className="ads-simple-table"><div><b>Statement</b><b>Provider</b><b>Amount</b><b>Status</b><b /></div><div><span>June 2026</span><span>Google Ads</span><span>€4,280</span><span className="table-success">Paid</span><button className="ads-more" type="button">⇩</button></div><div><span>June 2026</span><span>Meta Ads</span><span>€2,660</span><span className="table-success">Paid</span><button className="ads-more" type="button">⇩</button></div></div></section></>;
    return <><section className="ads-section-heading"><div><span className="ads-eyebrow">TEAM ACCESS</span><h2>Give every teammate the right access.</h2><p className="ads-subcopy">Separate who can see results, change budgets, approve creatives and launch campaigns.</p></div><button className="ads-primary-button" type="button" onClick={() => notify('Invite teammate form opened.')}>＋ Invite teammate</button></section><section className="ads-team-grid"><article className="ads-card ads-team-card"><div className="ads-team-member"><span className="member-avatar green">JM</span><div><strong>Jamie Morgan</strong><small>Workspace owner</small></div><span className="role-pill owner">Owner</span></div><div className="ads-team-perms"><span>✓ All channels</span><span>✓ Budget approval</span><span>✓ Launch campaigns</span></div></article><article className="ads-card ads-team-card"><div className="ads-team-member"><span className="member-avatar blue">AR</span><div><strong>Alex Rivera</strong><small>Performance marketer</small></div><span className="role-pill editor">Editor</span></div><div className="ads-team-perms"><span>✓ Campaigns and creatives</span><span>✓ Reports</span><span>× Billing controls</span></div></article><article className="ads-card ads-team-card"><div className="ads-team-member"><span className="member-avatar violet">SK</span><div><strong>Samira Khan</strong><small>Finance reviewer</small></div><span className="role-pill reviewer">Reviewer</span></div><div className="ads-team-perms"><span>✓ Reports</span><span>✓ Budget approvals</span><span>× Launch campaigns</span></div></article></section><section className="ads-card ads-role-card"><span className="ads-eyebrow">ROLE MATRIX</span><h2>Permissions stay explicit.</h2><div className="ads-role-table"><div><b>Role</b><b>View</b><b>Edit</b><b>Budget</b><b>Launch</b></div><div><span>Owner</span><span>✓</span><span>✓</span><span>✓</span><span>✓</span></div><div><span>Editor</span><span>✓</span><span>✓</span><span>Request</span><span>Request</span></div><div><span>Reviewer</span><span>✓</span><span>—</span><span>✓</span><span>—</span></div></div></section></>;
  }
  return <div className="ads-app-shell">
    <aside className="ads-rail"><div className="ads-brand"><div className="ads-brand-mark">L</div><div><strong>Lulu</strong><span>Growth OS</span></div></div><span className="ads-rail-label">WORKSPACE</span><nav className="ads-global-nav">{workspaceLinks.map(link => <button className="ads-muted-nav" type="button" key={link.label} onClick={() => notify(`${link.label} module selected.`)}><span className="ads-nav-icon">{link.icon}</span><span>{link.label}</span><b>⌄</b></button>)}</nav><button className="ads-module-switcher" type="button"><span className="ads-module-icon">◉</span><span>Paid Ads</span><span className="ads-chevron">⌃</span></button><nav className="ads-module-nav">{paidAdViews.map(item => <button className={`ads-nav-item ${activeView === item ? 'active' : ''}`} type="button" key={item} onClick={() => setActiveView(item)}><span>{item === 'Overview' ? '⌂' : item === 'Campaigns' ? '◈' : item === 'Planning' ? '◫' : item === 'Audiences' ? '♙' : item === 'Creatives' ? '✦' : item === 'Tracking' ? '⌁' : item === 'Reports' ? '▥' : item === 'Automations' ? '↗' : item === 'Integrations' ? '⌘' : item === 'Billing & Controls' ? '◉' : '♚'}</span>{item}{item === 'Campaigns' && <b>19</b>}</button>)}</nav><div className="ads-rail-spacer" /><div className="ads-rail-section"><span className="ads-rail-label">MODULES</span><button className="ads-muted-nav" type="button" onClick={() => notify('Marketplace selected.')}><span className="ads-nav-icon">⌘</span><span>Marketplace</span><b>⌄</b></button><button className="ads-muted-nav" type="button" onClick={() => notify('Settings selected.')}><span className="ads-nav-icon">⚙</span><span>Settings</span></button></div></aside>
    <main className="ads-main"><header className="ads-topbar"><div className="ads-breadcrumb"><span>Lulu</span><i>/</i><strong>Paid Ads</strong><i>/</i><strong>{activeView}</strong></div><div className="ads-top-actions"><button className="ads-icon-button" type="button" onClick={() => notify('Notifications are up to date.')}>♢</button><div className="ads-avatar">JM</div></div></header><div className="ads-page">
      <section className="ads-page-heading"><div><span className="ads-eyebrow">LULU PAID ADS · {activeView.toUpperCase()}</span><h1>{pageTitles[activeView]}</h1><p>Plan, launch and improve every paid campaign from one connected workspace.</p></div><div className="ads-heading-actions"><button className="ads-outline-button" type="button" onClick={() => notify('Campaign insights are being prepared.')}>View insights</button><button className="ads-primary-button" type="button" onClick={() => setShowCampaignModal(true)}>＋ Create campaign</button></div></section>
      {activeView === 'Overview' && <><section className="ads-kpi-grid"><article className="ads-kpi-card"><span>Total spend <b>ⓘ</b></span><strong>€8,880</strong><small className="positive">↗ 12.4% <em>vs. last month</em></small><div className="ads-sparkline violet"><i /><i /><i /><i /><i /><i /><i /></div></article><article className="ads-kpi-card"><span>Attributed revenue <b>ⓘ</b></span><strong>€42,640</strong><small className="positive">↗ 18.7% <em>vs. last month</em></small><div className="ads-sparkline blue"><i /><i /><i /><i /><i /><i /><i /></div></article><article className="ads-kpi-card"><span>Leads generated <b>ⓘ</b></span><strong>511</strong><small className="positive">↗ 9.2% <em>vs. last month</em></small><div className="ads-sparkline mint"><i /><i /><i /><i /><i /><i /><i /></div></article><article className="ads-kpi-card"><span>Blended ROAS <b>ⓘ</b></span><strong>4.8x</strong><small className="positive">↗ 0.6x <em>vs. last month</em></small><div className="ads-sparkline orange"><i /><i /><i /><i /><i /><i /><i /></div></article></section><section className="ads-main-grid"><article className="ads-card ads-performance-card"><div className="ads-card-header"><div><span className="ads-eyebrow">PERFORMANCE</span><h2>Paid acquisition is moving up.</h2><p>Spend, outcomes and attribution across your connected channels.</p></div><select value={platform} onChange={event => setPlatform(event.target.value as Platform)}><option>All platforms</option><option>Google Ads</option><option>Google LSA</option><option>Meta Ads</option><option>LinkedIn Ads</option></select></div><div className="ads-chart-legend"><span><i className="legend-spend" />Spend</span><span><i className="legend-revenue" />Attributed revenue</span><b>Last 30 days⌄</b></div><div className="ads-chart"><div className="ads-chart-y"><span>€50k</span><span>€35k</span><span>€20k</span><span>€5k</span><span>€0</span></div><div className="ads-chart-area"><div className="chart-grid" /><svg viewBox="0 0 760 240" preserveAspectRatio="none" aria-label="Performance chart"><path className="revenue-line" d="M0,190 C55,174 75,158 122,169 S180,136 220,150 S280,108 330,124 S392,83 440,97 S500,73 540,78 S610,43 650,51 S710,25 760,30" /><path className="spend-line" d="M0,212 C50,203 90,195 125,198 S185,174 220,182 S280,159 330,166 S390,140 440,149 S500,126 540,132 S610,108 650,111 S710,86 760,92" /></svg><div className="ads-chart-labels"><span>1 Jun</span><span>8 Jun</span><span>15 Jun</span><span>22 Jun</span><span>30 Jun</span></div></div></div></article><article className="ads-card ads-ai-card"><div className="ads-ai-orb">✦</div><span className="ads-eyebrow">LULU AI SIGNAL</span><h2>Shift budget to Meta this week.</h2><p>Meta is delivering 2.1x more qualified leads at €11.52 CPL. A 12% budget shift could add an estimated 34 leads.</p><button className="ads-outline-button" type="button" onClick={() => notify('Budget recommendation saved for review.')}>Review recommendation</button><div className="ads-ai-footer"><span>Generated from 4 channels</span><span>Updated 8 min ago</span></div></article></section><section className="ads-section-heading"><div><span className="ads-eyebrow">CONNECTED CHANNELS</span><h2>All your acquisition channels, together.</h2></div><button className="ads-text-button" type="button" onClick={() => setActiveView('Audiences')}>Manage connections →</button></section><section className="ads-platform-grid">{platformCards.map(card => <article className="ads-platform-card" key={card.name}><div className={`ads-platform-logo ${card.color}`}>{card.short}</div><div className="ads-platform-copy"><h3>{card.name}{connected.includes(card.name) && <span className="connected-dot" />}</h3><p>{card.detail}</p><small>{connected.includes(card.name) ? card.campaigns : 'Not connected'}</small></div><button className={connected.includes(card.name) ? 'ads-quiet-button' : 'ads-outline-button'} type="button" onClick={() => connectPlatform(card.name)}>{connected.includes(card.name) ? 'Manage' : 'Connect'}</button></article>)}</section><section className="ads-section-heading"><div><span className="ads-eyebrow">CAMPAIGN WORKSPACE</span><h2>Campaigns that need your attention.</h2></div><button className="ads-text-button" type="button" onClick={() => setActiveView('Campaigns')}>View all campaigns →</button></section>{renderCampaignTable()}</>}
      {activeView !== 'Overview' && renderSupportingPage()}
    </div></main>

    {selectedCampaign && <div className="ads-overlay ads-drawer-overlay" onMouseDown={event => event.target === event.currentTarget && setSelectedCampaign(null)}><aside className="ads-drawer"><div className="ads-drawer-head"><div><span className="ads-eyebrow">CAMPAIGN DETAIL · {selectedCampaign.platform.toUpperCase()}</span><h2>{selectedCampaign.name}</h2><p>{selectedCampaign.objective}</p></div><button className="ads-close" type="button" onClick={() => setSelectedCampaign(null)}>×</button></div><div className="ads-drawer-actions"><span className={`status-pill ${selectedCampaign.status.toLowerCase()}`}>{selectedCampaign.status}</span><button className="ads-outline-button" type="button" onClick={() => toggleCampaign(selectedCampaign.name)}>{selectedCampaign.status === 'Live' ? 'Ⅱ Pause campaign' : '▶ Resume campaign'}</button><button className="ads-primary-button" type="button" onClick={() => notify('Campaign editing opened.')}>Edit campaign</button></div><div className="ads-detail-stats"><div><span>Impressions</span><strong>{selectedCampaign.impressions}</strong></div><div><span>Clicks</span><strong>{selectedCampaign.clicks}</strong></div><div><span>CTR</span><strong>{selectedCampaign.ctr}</strong></div><div><span>Conversions</span><strong>{selectedCampaign.conversions}</strong></div><div><span>Revenue</span><strong>{selectedCampaign.revenue}</strong></div><div><span>CPL</span><strong>{selectedCampaign.cpl}</strong></div></div><section className="ads-drawer-section"><div className="ads-drawer-section-head"><div><span className="ads-eyebrow">PLAN AND PROGRESS</span><h3>What happens next</h3></div><span className="ads-drawer-meta">{selectedCampaign.schedule}</span></div><div className="ads-plan-list">{selectedCampaign.plan.map(step => <div className={`ads-plan-step ${step.status}`} key={step.label}><span className="ads-plan-marker">{step.status === 'done' ? '✓' : step.status === 'current' ? '•' : '○'}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><b>{step.status === 'done' ? 'Done' : step.status === 'current' ? 'In progress' : 'Upcoming'}</b></div>)}</div></section><section className="ads-drawer-section"><span className="ads-eyebrow">REASONING AND DECISIONS</span><h3>Why this campaign is running</h3><p className="ads-reasoning">{selectedCampaign.rationale}</p><div className="ads-next-step"><span>✦</span><div><strong>Recommended next step</strong><p>{selectedCampaign.nextStep}</p></div></div></section><section className="ads-drawer-section"><div className="ads-drawer-section-head"><div><span className="ads-eyebrow">USED ASSETS</span><h3>Everything in this campaign</h3></div><button className="ads-text-button" type="button" onClick={() => notify('Asset library opened.')}>Open library →</button></div><div className="ads-assets-grid">{selectedCampaign.assets.map(asset => <button className="ads-asset-card" type="button" key={asset.name} onClick={() => notify(`${asset.name} preview opened.`)}><div className={`ads-asset-preview ${asset.tone}`}><span>{asset.type.includes('Video') ? '▶' : asset.type.includes('PDF') ? 'PDF' : asset.type.includes('form') ? '☷' : '✦'}</span></div><strong>{asset.name}</strong><small>{asset.type} · {asset.meta}</small></button>)}</div></section><section className="ads-drawer-section ads-activity-section"><span className="ads-eyebrow">ACTIVITY HISTORY</span><div className="ads-activity-line"><span className="activity-dot green" /><p><strong>Budget recommendation generated</strong><small>Meta performance comparison · 8 min ago</small></p></div><div className="ads-activity-line"><span className="activity-dot blue" /><p><strong>Creative variant B became the leader</strong><small>Attribution model updated · Yesterday</small></p></div><div className="ads-activity-line"><span className="activity-dot purple" /><p><strong>Campaign reviewed by Jamie Morgan</strong><small>Plan and audience confirmed · 2 days ago</small></p></div></section></aside></div>}

    {renderUtilityModal()}
    {showCampaignModal && <div className="ads-overlay" onMouseDown={event => event.target === event.currentTarget && setShowCampaignModal(false)}><section className="ads-modal"><div className="ads-modal-head"><div><span className="ads-eyebrow">NEW CAMPAIGN</span><h2>Start a connected campaign.</h2><p>Choose a channel and keep the campaign connected to your audiences, creatives, assets and CRM outcomes.</p></div><button className="ads-close" type="button" onClick={() => setShowCampaignModal(false)}>×</button></div><form onSubmit={submitCampaign} className="ads-form"><label><span>Campaign name</span><input autoFocus placeholder="e.g. Summer launch · Munich" required /></label><div className="ads-form-grid"><label><span>Advertising channel</span><select defaultValue="Google Ads"><option>Google Ads</option><option>Google LSA</option><option>Meta Ads</option><option>LinkedIn Ads</option></select></label><label><span>Monthly budget</span><input placeholder="€ 2,500" required /></label></div><label><span>Primary goal</span><select defaultValue="Lead generation"><option>Lead generation</option><option>Website traffic</option><option>Sales</option><option>Brand awareness</option></select></label><div className="ads-form-note"><span>✦</span><p>Lulu will connect the campaign to your selected audience, asset library and CRM attribution once it is saved.</p></div><div className="ads-modal-actions"><button className="ads-outline-button" type="button" onClick={() => setShowCampaignModal(false)}>Cancel</button><button className="ads-primary-button" type="submit">Save campaign draft</button></div></form></section></div>}
    {toast && <div className="ads-toast"><span>✓</span>{toast}</div>}
  </div>;
};