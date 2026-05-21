const slides = [...document.querySelectorAll('.slide')];
let i = 0
  , paused = false;
function show(n) {
    slides.forEach(s => s.classList.remove('active'));
    if (slides.length) {
        slides[(n + slides.length) % slides.length].classList.add('active');
        i = (n + slides.length) % slides.length
    }
}
document.querySelectorAll('[data-next]').forEach(b => b.onclick = () => show(i + 1));
document.querySelectorAll('[data-prev]').forEach(b => b.onclick = () => show(i - 1));
document.querySelectorAll('[data-pause]').forEach(b => b.onclick = () => {
    paused = !paused;
    b.textContent = paused ? 'Play' : 'Pause'
}
);
setInterval( () => {
    if (!paused)
        show(i + 1)
}
, 4500);
const SUMMERS_VIBES_API_BASE_URL = (window.SUMMERS_VIBES_API_BASE_URL || 'https://summers-vibes-api.onrender.com').replace(/\/$/, '');
const forms = document.querySelectorAll('form[data-smart-form]');
const setFormStatus = (form, message, type = 'info') => {
    let msg = form.querySelector('.form-message');
    if (!msg) {
        msg = document.createElement('p');
        msg.className = 'form-message';
        form.append(msg);
    }
    msg.textContent = message;
    msg.dataset.type = type;
    msg.setAttribute('aria-live', 'polite');
};
const setFormLoading = (form, isLoading) => {
    const button = form.querySelector('button[type="submit"], .finder-submit');
    if (!button)
        return;
    if (!button.dataset.originalText)
        button.dataset.originalText = button.textContent;
    button.disabled = isLoading;
    button.textContent = isLoading ? (form.dataset.loadingText || 'Sending...') : button.dataset.originalText;
};
const getFormType = form => {
    if (form.dataset.formType)
        return form.dataset.formType;
    if (form.classList.contains('newsletter-form'))
        return 'newsletter';
    if (form.classList.contains('ticket-finder'))
        return 'ticket';
    return 'contact';
};
const formToPayload = form => {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.sourcePage = window.location.pathname.split('/').pop() || 'index.html';
    if (payload['newsletter-email'] && !payload.email)
        payload.email = payload['newsletter-email'];
    if (getFormType(form) === 'newsletter')
        payload.consent = true;
    return payload;
};
const apiRequest = async (path, payload) => {
    const response = await fetch(`${SUMMERS_VIBES_API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch( () => ({}));
    if (!response.ok)
        throw new Error(data.error || 'The request could not be completed. Please try again.');
    return data;
};
const handleTicketSubmit = async form => {
    const data = await apiRequest('/api/tickets/create-checkout-session', formToPayload(form));
    if (!data.url)
        throw new Error('Stripe did not return a checkout link. Please try again.');
    window.location.href = data.url;
};
const handleStandardSubmit = async (form, type) => {
    const endpointMap = {
        contact: '/api/contact',
        newsletter: '/api/newsletter'
    };
    const successMap = {
        contact: form.dataset.successMessage || 'Thank you. Your message has been received for Summers Vibes.',
        newsletter: form.dataset.successMessage || 'Thank you. You are signed up for Summers Vibes updates.'
    };
    await apiRequest(endpointMap[type], formToPayload(form));
    setFormStatus(form, successMap[type], 'success');
    form.reset();
};
forms.forEach(form => {
    const type = getFormType(form);
    const honeypot = document.createElement('input');
    honeypot.className = 'form-honeypot';
    honeypot.name = 'website';
    honeypot.tabIndex = -1;
    honeypot.setAttribute('autocomplete', 'off');
    honeypot.setAttribute('aria-hidden', 'true');
    form.append(honeypot);

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        try {
            setFormLoading(form, true);
            setFormStatus(form, type === 'ticket' ? 'Opening secure checkout...' : 'Sending...', 'info');
            if (type === 'ticket')
                await handleTicketSubmit(form);
            else
                await handleStandardSubmit(form, type);
        } catch (error) {
            setFormStatus(form, error.message, 'error');
        } finally {
            setFormLoading(form, false);
        }
    });
});
const ticketQty = document.querySelector('#ticketQty')
  , ticketType = document.querySelector('#ticketType')
  , ticketTotal = document.querySelector('#ticketTotal');
const gbpFormatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
});
function calc() {
    if (!ticketQty || !ticketType)
        return;
    const selected = ticketType.selectedOptions && ticketType.selectedOptions[0];
    const price = selected ? Number(selected.dataset.price || selected.value || 0) : 0;
    ticketTotal.textContent = gbpFormatter.format(Number(ticketQty.value || 0) * price)
}
[ticketQty, ticketType].forEach(x => x && x.addEventListener('input', calc));
calc();
// Site-wide motion system
(() => {
    const page = document.body;
    // Index page button ripple effects
    if (page.classList.contains('home-page')) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const indexButtons = [...document.querySelectorAll('a, button, .btn')].filter(el => !el.classList.contains('brand'));
        indexButtons.forEach(el => el.classList.add('index-button-motion'));
        page.classList.add('index-button-motion-ready');
        // Index page reversible text reveal
        const indexTextItems = [...document.querySelectorAll([
            '.home-hero-copy > *',
            '.editorial-heading > *',
            '.editorial-grid article h3',
            '.editorial-grid article p',
            '.editorial-grid article a',
            '.feature-panel-copy > *',
            '.home-boutique-copy > *'
        ].join(','))];
        indexTextItems.forEach((el, index) => {
            el.classList.add('index-text-reveal');
            el.style.setProperty('--index-text-delay', `${Math.min(index * 55, 420)}ms`);
        });
        page.classList.add('index-text-reveal-ready');

        const indexPictureItems = [...document.querySelectorAll([
            '.editorial-grid article',
            '.feature-panel',
            '.home-boutique'
        ].join(','))];
        indexPictureItems.forEach((el, index) => {
            el.classList.add('index-picture-reveal');
            el.style.setProperty('--index-picture-delay', `${Math.min(index * 90, 360)}ms`);
        });
        page.classList.add('index-picture-reveal-ready');

        const indexFooterItems = [...document.querySelectorAll([
            '.site-footer .footer-holo-cta',
            '.site-footer .footer-brand-card',
            '.site-footer .footer-column',
            '.site-footer .footer-bottom'
        ].join(','))];
        indexFooterItems.forEach((el, index) => {
            el.classList.add('index-footer-reveal');
            el.style.setProperty('--index-footer-delay', `${Math.min(index * 90, 360)}ms`);
        });
        page.classList.add('index-footer-reveal-ready');

        const revealText = el => el.classList.add('is-revealed');
        const hideText = el => el.classList.remove('is-revealed');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            indexTextItems.forEach(revealText);
        } else {
            const textObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting)
                        revealText(entry.target);
                    else
                        hideText(entry.target);
                });
            }, {
                threshold: 0.12,
                rootMargin: '0px 0px -6% 0px'
            });
            indexTextItems.forEach(el => textObserver.observe(el));
        }

        const revealPicture = el => el.classList.add('is-revealed');
        const hidePicture = el => el.classList.remove('is-revealed');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            indexPictureItems.forEach(revealPicture);
        } else {
            const pictureObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting)
                        revealPicture(entry.target);
                    else
                        hidePicture(entry.target);
                });
            }, {
                threshold: 0.18,
                rootMargin: '0px 0px -10% 0px'
            });
            indexPictureItems.forEach(el => pictureObserver.observe(el));
        }

        const revealFooter = el => el.classList.add('is-revealed');
        const hideFooter = el => el.classList.remove('is-revealed');
        if (reduceMotion || !('IntersectionObserver' in window)) {
            indexFooterItems.forEach(revealFooter);
        } else {
            const footerObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting)
                        revealFooter(entry.target);
                    else
                        hideFooter(entry.target);
                });
            }, {
                threshold: 0.16,
                rootMargin: '0px 0px -8% 0px'
            });
            indexFooterItems.forEach(el => footerObserver.observe(el));
        }

        document.addEventListener('click', event => {
            const control = event.target.closest('.index-button-motion');
            if (!control || control.disabled || reduceMotion)
                return;
            const rect = control.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.className = 'motion-ripple';
            const size = Math.max(rect.width, rect.height) * 1.45;
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
            control.appendChild(ripple);
            window.setTimeout(() => ripple.remove(), 650);
        });

        document.addEventListener('click', event => {
            const link = event.target.closest('a[href]');
            if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
            if (link.target || link.hasAttribute('download'))
                return;
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
                return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin)
                return;
            if (url.pathname === window.location.pathname && url.hash)
                return;
            event.preventDefault();
            page.classList.add('page-is-leaving');
            window.setTimeout(() => {
                window.location.href = link.href;
            }, reduceMotion ? 0 : 420);
        });
        return;
    }
    if (!page)
        return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const unique = items => [...new Set(items)].filter(Boolean);
    const all = selector => [...document.querySelectorAll(selector)];
    const main = document.querySelector('main');

    page.classList.add('motion-ready');

    const heroes = unique(all('main > section:first-child, main [class*="hero"], main .experience-showcase, main .headliner-picks, main .lineup-editorial, main .visit-locator, main .byday-chart'));
    heroes.forEach(hero => hero.classList.add('motion-hero', 'motion-parallax'));

    const textItems = unique(all([
        'main h1',
        'main h2',
        'main h3',
        'main p',
        'main li',
        'main summary',
        'main label',
        'main .home-kicker',
        'main .access-kicker',
        '.site-footer .footer-holo-copy > *',
        '.site-footer .footer-brand-card > *',
        '.site-footer .footer-column > *',
        '.site-footer .footer-bottom > *'
    ].join(',')));

    const boxItems = unique(all([
        'main article',
        'main form',
        'main iframe',
        'main img',
        'main .ticket-finder',
        'main .visit-panel',
        'main .visit-map-wrap',
        'main .service-notice',
        'main .faq-service-panel',
        'main .newsletter-signup',
        'main .travel-booking-card',
        'main .travel-welcome-card',
        'main .travel-options > article',
        'main .contact-option-card',
        'main .experience-card',
        'main .strip-card',
        'main .news-card',
        'main .ticket-pass',
        '.site-footer .footer-holo-cta',
        '.site-footer .footer-brand-card',
        '.site-footer .footer-column'
    ].join(',')));

    const revealItems = unique([...textItems, ...boxItems]).filter(el => !el.closest('.nav') && !el.closest('script,style'));
    revealItems.forEach(el => {
        el.classList.add('motion-reveal');
        if (textItems.includes(el))
            el.classList.add('motion-text');
        if (boxItems.includes(el))
            el.classList.add('motion-box');

        const siblings = [...el.parentElement.children].filter(child => revealItems.includes(child));
        const index = Math.max(0, siblings.indexOf(el));
        el.style.setProperty('--motion-delay', `${Math.min(index * 80, 480)}ms`);
    });

    const kineticHeadings = unique(all('main > section:first-child h1, main > section:first-child h2, main [class*="hero"] h1, main [class*="hero"] h2, .footer-holo-copy h2'));
    kineticHeadings.forEach(heading => {
        if (heading.querySelector('.motion-char'))
            return;
        const label = heading.textContent.replace(/\s+/g, ' ').trim();
        if (!label)
            return;
        heading.classList.add('motion-letters');
        heading.setAttribute('aria-label', label);
        let count = 0;
        const splitText = node => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent;
                    if (!text.trim())
                        return;
                    const fragment = document.createDocumentFragment();
                    [...text].forEach(char => {
                        const span = document.createElement('span');
                        span.className = 'motion-char';
                        span.setAttribute('aria-hidden', 'true');
                        span.style.setProperty('--char-delay', `${Math.min(count * 22, 900)}ms`);
                        span.textContent = char === ' ' ? '\u00a0' : char;
                        fragment.appendChild(span);
                        count += 1;
                    });
                    child.replaceWith(fragment);
                    return;
                }
                if (child.nodeType === Node.ELEMENT_NODE)
                    splitText(child);
            });
        };
        splitText(heading);
    });

    all('a, button, .btn, input, select, textarea').forEach(el => el.classList.add('motion-interactive'));
    all('main article, main .card, main .ticket-pass, main .contact-option-card, main .news-card, main .lineup-story, main .headliner-pick-card, main .travel-options > article, main .visit-essentials-grid > article').forEach(el => el.classList.add('motion-tilt'));
    all('.hero-pause, .footer-status, .visit-map-pin, .access-mail, .ticket-total, .travel-stars').forEach(el => el.classList.add('motion-float'));

    const reveal = el => el.classList.add('is-revealed');
    const hide = el => el.classList.remove('is-revealed');
    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealItems.forEach(reveal);
    } else {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting)
                    reveal(entry.target);
                else
                    hide(entry.target);
            });
        }, {
            threshold: 0.13,
            rootMargin: '0px 0px -8% 0px'
        });
        revealItems.forEach(el => observer.observe(el));
    }

    if (!reduceMotion) {
        let ticking = false;
        let lastParallaxY = -1;
        const updateParallax = () => {
            ticking = false;
            const viewport = window.innerHeight || 1;
            const pageDrift = Math.round(Math.min(64, window.scrollY * 0.035));
            if (pageDrift !== lastParallaxY) {
                page.style.setProperty('--page-parallax-y', `${pageDrift}px`);
                lastParallaxY = pageDrift;
            }
            heroes.forEach(hero => {
                const rect = hero.getBoundingClientRect();
                const centerOffset = (rect.top + rect.height / 2 - viewport / 2) / viewport;
                const y = Math.round(Math.max(-42, Math.min(42, centerOffset * -34)));
                hero.style.setProperty('--parallax-y', `${y}px`);
            });
        };
        const queueParallax = () => {
            if (ticking)
                return;
            ticking = true;
            requestAnimationFrame(updateParallax);
        };
        updateParallax();
        window.addEventListener('scroll', queueParallax, { passive: true });
        window.addEventListener('resize', queueParallax);

        let scrollEndTimer = 0;
        window.addEventListener('scroll', () => {
            page.classList.add('is-scrolling');
            window.clearTimeout(scrollEndTimer);
            scrollEndTimer = window.setTimeout(() => {
                page.classList.remove('is-scrolling');
            }, 140);
        }, { passive: true });
    }

    document.addEventListener('pointermove', event => {
        if (page.classList.contains('is-scrolling'))
            return;
        const card = event.target.closest('.motion-tilt');
        if (!card || reduceMotion)
            return;
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - .5) * 8;
        const y = ((event.clientY - rect.top) / rect.height - .5) * -8;
        card.style.setProperty('--tilt-x', `${y.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${x.toFixed(2)}deg`);
    });

    document.addEventListener('pointerleave', event => {
        const card = event.target.closest && event.target.closest('.motion-tilt');
        if (!card)
            return;
        card.style.removeProperty('--tilt-x');
        card.style.removeProperty('--tilt-y');
    }, true);

    document.addEventListener('click', event => {
        const control = event.target.closest('a, button, .btn');
        if (!control || control.disabled || reduceMotion)
            return;
        const rect = control.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'motion-ripple';
        const size = Math.max(rect.width, rect.height) * 1.45;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
        control.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 650);
    });

    const status = document.querySelector('.footer-status');
    if (status && !reduceMotion) {
        const phrases = ['Festival info live', 'Tickets ready', 'Travel guide live'];
        let phraseIndex = 0;
        window.setInterval(() => {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            status.classList.add('is-morphing');
            window.setTimeout(() => {
                status.textContent = phrases[phraseIndex];
                status.classList.remove('is-morphing');
            }, 180);
        }, 3600);
    }

    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        if (link.target || link.hasAttribute('download'))
            return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
            return;
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin)
            return;
        if (url.pathname === window.location.pathname && url.hash)
            return;
        event.preventDefault();
        page.classList.add('page-is-leaving');
        window.setTimeout(() => {
            window.location.href = link.href;
        }, reduceMotion ? 0 : 420);
    });
})();

// Site-wide liquid pointer surface
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion || !finePointer)
        return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;

    canvas.className = 'liquid-cursor-surface';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    document.body.classList.add('liquid-cursor-ready');

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrame = 0;
    let lastRipple = 0;
    let scrolling = false;
    let scrollTimer = 0;
    const ripples = [];
    const pointer = {
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        active: false
    };

    const resize = () => {
        pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const addRipple = (x, y, force = 1) => {
        ripples.push({
            x,
            y,
            age: 0,
            life: 46 + Math.random() * 12,
            radius: 12 + force * 10,
            force: Math.min(force, 3.2)
        });
        if (ripples.length > 24)
            ripples.shift();
    };

    const draw = () => {
        if (scrolling) {
            ctx.clearRect(0, 0, width, height);
            ripples.length = 0;
            animationFrame = requestAnimationFrame(draw);
            return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';

        for (let index = ripples.length - 1; index >= 0; index -= 1) {
            const ripple = ripples[index];
            ripple.age += 1;
            const progress = ripple.age / ripple.life;
            if (progress >= 1) {
                ripples.splice(index, 1);
                continue;
            }

            const ease = 1 - Math.pow(1 - progress, 3);
            const radius = ripple.radius + ease * (82 + ripple.force * 22);
            const alpha = (1 - progress) * .34;
            const wobble = Math.sin(progress * Math.PI * 5) * 3.5;

            const gradient = ctx.createRadialGradient(ripple.x, ripple.y, Math.max(1, radius * .22), ripple.x, ripple.y, radius);
            gradient.addColorStop(0, `rgba(255,255,255,${alpha * .08})`);
            gradient.addColorStop(.42, `rgba(5,217,232,${alpha * .18})`);
            gradient.addColorStop(.68, `rgba(255,210,63,${alpha * .2})`);
            gradient.addColorStop(1, 'rgba(255,255,255,0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, radius + wobble, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(255,255,255,${alpha * .55})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, radius * .58, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (pointer.active) {
            const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 34);
            glow.addColorStop(0, 'rgba(255,255,255,.34)');
            glow.addColorStop(.5, 'rgba(5,217,232,.16)');
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(pointer.x, pointer.y, 34, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        animationFrame = requestAnimationFrame(draw);
    };

    const handlePointerMove = event => {
        pointer.previousX = pointer.x || event.clientX;
        pointer.previousY = pointer.y || event.clientY;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;

        const distance = Math.hypot(pointer.x - pointer.previousX, pointer.y - pointer.previousY);
        const now = performance.now();
        if (distance > 9 && now - lastRipple > 54 && !scrolling) {
            addRipple(pointer.x, pointer.y, Math.max(1, distance / 18));
            lastRipple = now;
        }
    };

    const handleScroll = () => {
        scrolling = true;
        pointer.active = false;
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
            scrolling = false;
        }, 130);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', () => {
        pointer.active = false;
    });
    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationFrame);
    });
})();











