import { getCurrentUser } from '../core/auth.js';
import { mountLayout } from '../components/layout.js';

// For pages that are just text: only the header and footer need to load.
mountLayout({ user: await getCurrentUser(), active: document.body.dataset.active || '' });
