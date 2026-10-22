/**
 * Computer Rush — English vocabulary groups.
 *
 * Mỗi nhóm là một chuỗi từ/cụm từ cách nhau bởi dấu phẩy hoặc xuống dòng.
 * Chỉ chứa từ thật, cụm từ tự nhiên, thuật ngữ công việc phổ thông.
 * Không profanity, không slogan chính trị, không tên riêng, không thương hiệu.
 *
 * Metadata (language/category/difficulty/length/family/id) được suy ra trong
 * `index.mjs`, không hard-code ở đây để tránh lệch số liệu.
 */

export const ENGLISH_GROUPS = [
  {
    category: 'work',
    words: `
meeting, agenda, minutes, memo, brief, proposal, estimate, milestone, deliverable, stakeholder,
vendor, invoice, receipt, contract, policy, procedure, checklist, template, archive, label,
note, draft, revision, comment, mention, delegate, followup, status, update, summary,
outline, schedule, deadline, planning, priority, review, feedback, workflow, progress, target,
strategy, research, analysis, budget, timeline, project, report, document, approval, task,
calendar, appointment, conference, workshop, seminar, briefing, onboarding, training, mentor, manager,
director, supervisor, colleague, teammate, intern, payroll, salary, overtime, leave, vacation,
holiday, absence, attendance, roster, shift, desk, office, cubicle, printer, scanner,
stationery, binder, notebook, clipboard, whiteboard, marker, staple, envelope, package, courier,
shipment, inventory, supplier, purchase, order, refund, warranty, quotation, negotiation, agreement,
partnership, merger, acquisition, subsidiary, department, division, branch, headquarters, campus, facility,
maintenance, repair, inspection, audit, compliance, regulation, guideline, standard, benchmark, objective,
outcome, impact, metric, indicator, dashboard, spreadsheet, worksheet, formula, chart, graph,
table, column, row, filter, sort, query, backup, restore, attachment, recipient,
sender, subject, inbox, outbox, capacity, quota, license, subscription, renewal, expiry,
reminder, notification, escalation, resolution, incident, ticket, inquiry, complaint, survey, questionnaire,
interview, candidate, resume, vacancy, recruitment, probation, appraisal, promotion, transfer, resignation,
retirement, handover, induction, orientation, workload, bottleneck, dependency, blocker, roadmap, backlog,
sprint, standup, retrospective, iteration, release, rollout, deployment, migration, integration, automation,
documentation, playbook, protocol, framework, pipeline, throughput, latency, outage, rollback, failover,
redundancy, monitoring, logging, alerting, threshold, postmortem, diagnosis, triage, escalate, prioritize,
assign, approve, reject, revise, finalize, submit, endorse, confirm, reschedule, cancel,
postpone, notify, remind, attach, forward, categorize, annotate, bookmark, invite, present,
timesheet, payslip, deduction, benefit, allowance, reimbursement, headcount, attrition, turnover, morale,
wellbeing, burnout, delegation, charter, mandate, scope, grievance, termination, severance, mentorship,
coaching, upskilling, reskilling, certification, curriculum, masterclass, bootcamp, debrief, handoff, bookkeeping,
`
  },
  {
    category: 'media',
    words: `
content, editor, editing, thumbnail, caption, script, footage, camera, channel, audience,
episode, subtitle, render, upload, publish, creator, production, storyboard, broadcast, podcast,
livestream, recording, microphone, headphones, speaker, audio, sound, soundtrack, visual, frame,
clip, montage, transition, sequence, shot, angle, lighting, studio, prop, costume,
makeup, rehearsal, take, scene, screenplay, dialogue, narrator, voiceover, dubbing, translation,
transcript, captioning, watermark, branding, poster, flyer, brochure, newsletter, magazine, journal,
blog, article, headline, byline, editorial, feature, premiere, trailer, teaser, promo,
sponsor, sponsorship, monetization, analytics, engagement, reach, impression, viewership, subscriber, follower,
reaction, viral, trending, hashtag, cover, playlist, album, track, lyrics, melody,
rhythm, beat, tempo, chorus, verse, remix, mastering, mixing, equalizer, waveform,
bitrate, codec, letterbox, aspect, framerate, keyframe, cut, outtake, animatic, motion,
animation, graphics, colorist, grading, saturation, exposure, broll, voicecast, teleprompter, lens,
focus, shutter, aperture, tripod, gimbal, drone, boom, mixer, fader, monitor,
headset, ambience, reverb, echo, pitch, groove, hook, riff, chord, tune,
jingle, narration, infographic, carousel, reel, shortform, longform, vlog, webcast, simulcast,
syndication, royalty, embargo, exclusive, showcase, highlight, montage reel, press kit, media kit, style frame,
mood reel, sound bite, voice track, lower third, title card, end card, cold open, broll shot, talking head, walkthrough,
`
  },
  {
    category: 'design',
    words: `
design, layout, spacing, contrast, typography, palette, gradient, vector, canvas, illustration,
component, prototype, interface, alignment, border, shadow, radius, icon, banner,
wireframe, mockup, sketch, grid, gutter, margin, padding, kerning, leading, tracking,
hierarchy, balance, symmetry, proportion, texture, pattern, opacity, blend, layer,
mask, stroke, fill, brush, pencil, ruler, eraser, swatch, hue, tint,
shade, tone, luminance, brightness, bezier, anchor, path, node, curve, corner,
silhouette, composition, whitespace, scale, zoom, crop, rotate, flip, duplicate,
group, ungroup, arrange, distribute, snap, guide, artboard, viewport, breakpoint, responsive,
adaptive, fluid, mobile, desktop, tablet, accessibility, affordance, usability, heuristic, persona,
journey, wireflow, critique, moodboard, styleguide, brandbook, logotype, wordmark, emblem, monogram,
pictogram, glyph, serif, sans, monospace, ligature, baseline, ascender, descender, italic,
bold, weight, display, colorway, overlay, backdrop, halftone, duotone, monochrome, vignette,
motif, ornament, breadcrumb, tooltip, accordion, dropdown, checkbox, toggle, slider, stepper,
badge, chip, avatar, skeleton, spinner, toast, modal, drawer, sidebar, toolbar,
pagination, placeholder, validation, booklet, leaflet, postcard, sticker, packaging, easel, gouache,
watercolor, charcoal, pastel, acrylic, stencil, collage, engraving, printmaking, letterpress, typesetting,
`
  },
  {
    category: 'technology',
    words: `
computer, keyboard, browser, server, database, network, software, hardware, frontend, backend,
storage, memory, processor, request, response, socket, cache, system, terminal, runtime,
compile, execute, debug, deploy, container, cluster, instance, virtual, cloud, region,
bucket, object, payload, endpoint, gateway, proxy, firewall, certificate, encryption, authentication,
authorization, session, cookie, token, header, packet, bandwidth, queue, worker, scheduler,
thread, process, kernel, driver, firmware, bootloader, filesystem, directory, symlink, permission,
ownership, checksum, hash, salt, signature, cipher, algorithm, recursion, variable, constant,
function, parameter, argument, return, exception, callback, promise, async, await, module,
library, version, changelog, repository, commit, fork, merge, rebase, conflict, diff,
patch, artifact, registry, mirror, schema, seed, fixture, mock, stub, snapshot,
replica, shard, partition, transaction, isolation, durability, consistency, deadlock, race, mutex,
semaphore, lock, unlock, atomic, idempotent, retry, backoff, circuit, breaker, healthcheck,
probe, telemetry, trace, span, log, severity, throttle, polling, webhook, lease,
compiler, interpreter, assembler, bytecode, heap, stack, pointer, reference, closure, coroutine,
generator, iterator, predicate, lambda, namespace, abstract, inherit, polymorphism, encapsulation, decorator,
middleware, router, controller, resolver, serializer, validator, sanitizer, formatter, parser, lexer,
tokenizer, grammar, syntax, semantic, opcode, register, instruction, jitter, handshake, keepalive,
heartbeat, timeout, replication, quorum, consensus, cron, daemon, sidecar, ingress, egress,
manifest, orchestrator, provisioner, autoscaling, observability, instrumentation, remediation, runbook, versioning, clone,
stash, linter, bundler, transpiler, minifier, sourcemap, polyfill, shim, loadbalancer,
`
  },
  {
    category: 'business',
    words: `
customer, revenue, market, sales, finance, growth, product, service, company, campaign,
conversion, segment, forecast, operation, performance, brand, partner, pricing, markup, profit,
loss, expense, cashflow, ledger, solvency, equity, asset, liability, investment, funding,
capital, valuation, stake, dividend, interest, credit, debit, procurement, logistics, distribution,
wholesale, retail, franchise, outlet, storefront, marketplace, competitor, positioning, differentiation, offering,
portfolio, lifecycle, churn, retention, loyalty, upsell, crosssell, prospect, lead, funnel,
territory, commission, incentive, discount, bundle, trial, cancellation, satisfaction, insight, hypothesis,
experiment, cohort, uplift, variance, correlation, trend, demand, supply, shortage, surplus,
inflation, recession, economy, industry, sector, enterprise, startup, venture, incubator, accelerator,
shareholder, board, committee, governance, transparency, accountability, sustainability, risk, mitigation, contingency,
insurance, trademark, patent, copyright, licensing, franchisee, conglomerate, affiliate, reseller, distributor,
intermediary, broker, agent, tender, bid, escrow, collateral, amortization, depreciation, overhead,
leverage, synergy, repayment, liquidity, runway, rebate, tariff, duty, levy, subsidy,
grant, endowment, underwriting, premium, claim, actuary, spinoff, divestiture, stewardship, yield,
coupon, maturity, principal, annuity, mortgage, tenancy, indemnity, arbitration, mediation, litigation,
settlement, injunction, affidavit, notary, deed, lien, forfeiture, insolvency, bankruptcy, liquidation,
receivership, restructuring, downsizing, outsourcing, offshoring, nearshoring, subcontract, consignment, freight, cargo,
pallet, warehouse, depot, dispatch, fulfillment, awareness, consideration, advocacy, messaging, segmentation,
targeting, frequency, attribution, retargeting, remarketing, influencer, testimonial, whitepaper, webinar, roadshow,
merchandising, showroom, tender offer, break even, unit economics, price ceiling, cost center, profit margin, gross margin, net worth,
`
  },
  {
    category: 'everyday',
    words: `
morning, coffee, window, street, garden, summer, winter, travel, friend, family,
yellow, orange, silver, mountain, river, ocean, dream, happy, energy, kitchen,
dinner, breakfast, lunch, blanket, pillow, curtain, balcony, rooftop, bicycle, scooter,
umbrella, jacket, sweater, sneaker, sandal, bracelet, necklace, vanity, candle, lantern,
basket, bottle, kettle, teapot, spoon, ladle, knife, plate, bowl, towel,
soap, comb, shelf, wardrobe, closet, carpet, ceiling, floor, wall, roof,
gate, fence, porch, chimney, elevator, staircase, corridor, courtyard, neighborhood, village,
city, town, suburb, park, playground, bookstore, museum, theater, cinema, restaurant,
bakery, grocery, pharmacy, hospital, clinic, dentist, doctor, nurse, teacher, student,
school, college, classroom, homework, lesson, exam, backpack, sharpener, crayon, glitter,
puzzle, kite, balloon, marble, whistle, trampoline, hammock, campfire, picnic, barbecue,
festival, carnival, parade, concert, exhibition, gallery, fountain, bridge, tunnel, harbor,
lighthouse, windmill, barn, meadow, forest, desert, island, volcano, glacier, waterfall,
canyon, cliff, valley, hill, lake, drizzle, thunder, rainbow, breeze, sunshine,
moonlight, starlight, dawn, dusk, twilight, candlelight, fireplace, armchair, bookshelf, doormat,
cup, mug, pen, bag, box, key, map, hat, cap, sky,
sea, sun, moon, star, rain, snow, wind, tree, leaf, root,
sprout, rock, sand, wave, fire, wood, iron, gold, silk, wool,
cake, soup, rice, egg, milk, tea, jam, pie, pepper, corn,
bean, pear, plum, fig, nut, oat, bun, pot, pan, lid,
jar, tin, dish, sink, rope, nail, tape, glue, card, coin,
page, book, poem, song, film, play, game, contest, jump, swim,
walk, rest, nap, hug, sing, read, draw, cook, bake, wash,
fold, sweep, plant, grow, pick, gift, joke, luck, hope, calm,
warm, cool, cold, soft, loud, quiet, brave, kind, wise, shy,
glad, busy, tidy, cozy, fresh, sweet, sour, spicy, crisp, plain,
round, square, sharp, smooth, rough, heavy, light, wide, narrow, deep,
shallow, early, late, fast, slow, near, far, high, low, young,
`
  },
  {
    category: 'phrase',
    words: `
creative team, video editor, project plan, daily report, content creator, team meeting, work schedule, design review,
brand identity, social media, target audience, user journey, landing page, product launch, market research, sales funnel,
customer support, budget planning, team building, office space, remote work, hybrid work, deep work, focus time,
quick note, status update, action item, follow up, kick off, wrap up, sign off, roll out,
check in, check out, hand over, take over, scale up, ramp up, spin up, back up,
creative brief, content calendar, editorial plan, production schedule, shooting script, color palette, visual identity, design system,
user testing, feedback loop, bug report, release note, code review, pull request, merge conflict, version control,
data pipeline, cloud storage, file format, image quality, video quality, sound design, motion design, brand voice,
press release, media coverage, social reach, paid media, owned media, earned media, content pillar, brand story,
client brief, scope creep, change request, risk register, issue log, action plan, weekly sync, daily standup,
`
  },
  {
    category: 'phrase3',
    words: `
creative content team, daily project report, video production plan, content marketing strategy, user experience design,
product design review, quarterly business review, customer success team, social media campaign, brand awareness campaign,
project management office, remote collaboration tool, design thinking workshop, agile development team, continuous integration pipeline,
performance review meeting, content distribution plan, digital marketing funnel, customer journey map, product roadmap planning,
team performance metric, creative workflow process, video editing workflow, visual design language, brand style guide,
content moderation policy, data driven decision, quality assurance process, release management plan, incident response plan,
`
  },
  {
    category: 'everyday',
    words: `
act, add, age, aim, air, arm, art, ask, ban, bar, bat, bed, bee, bet, toss, bin, bit, bow, boy, bus,
buy, cab, can, car, cat, cow, cry, trim, day, dig, dim, dip, dog, dot, dry, due, ear, eat, end, eye,
fan, fat, fee, few, fit, fix, fly, fog, fun, fur, gap, gas, gym, ham, hen, hip, hit, hot, ice, ink,
inn, jaw, job, jog, joy, jug, kid, kit, lab, lap, law, lay, leg, lie, lip, twig, lot, mad, man, mat,
mix, mud, net, nod, oak, oil, one, owl, own, pad, pay, pea, peg, pet, pig, pin, pit, pod, pop, pub,
put, rag, ram, rat, raw, ray, red, rib, rid, rig, rim, rip, rob, rod, rub, rug, run, sad, saw, say,
see, set, sew, sip, sit, six, ski, sly, sob, sock, sofa, son, spa, spy, sum, tag, tan, tap, tar, tax,
ten, tie, tip, toe, ton, top, toy, try, tub, two, van, vet, via, vow, wax, way, web, wet, wig, win,
wit, wok, yes, zip, zoo,
`
  },
  {
    category: 'work',
    words: `
achievement, adjustment, administration, announcement, anticipation, appreciation, arrangement, assessment, assistance, association,
assumption, availability, beneficiary, calculation, calibration, capability, celebration, clarification, classification, collaboration,
combination, commentary, commitment, communication, comparison, compensation, competence, competition, compilation, complexity,
comprehension, compromise, concentration, conclusion, confidence, configuration, confirmation, connection, consequence, conservation,
consolidation, construction, consultation, contribution, convenience, conversation, cooperation, coordination, corporation, correction,
credibility, criticism, cultivation, curiosity, declaration, dedication, definition, allocation, delivery, demonstration,
description, designation, determination, development, difference, difficulty, disagreement, discipline, disclosure, discovery,
`
  },
  {
    category: 'technology',
    words: `
architecture, virtualization, background, breakthrough, broadcasting, computation, connectivity, cybersecurity, engineering, entertainment,
environment, equipment, equivalent, establishment, evaluation, evolution, examination, excellence, execution, expansion,
expectation, explanation, exploration, expression, extraction, familiarity, flexibility, foundation, generation, geography,
graduation, guidance, identification, imagination, implementation, importance, improvement, inclusion, independence, indication,
individual, infrastructure, initiative, innovation, inspiration, installation, blueprint, instrument, intelligence, interaction,
interpretation, introduction, investigation, invitation, involvement, journalism, knowledge, laboratory, landscape, leadership,
`
  },
  {
    category: 'media',
    words: `
advertising, announcer, anthology, articulation, audition, cameraman, choreography, cinematography, circulation, correspondent,
documentary, dramaturgy, filmmaking, improvisation, journalist, manuscript, multimedia, narrative, newscast, orchestration,
photography, photojournalism, playwright, podcasting, publication, publicity, reporting, screenwriter, screenwriting, showrunner,
soundstage, storytelling, subtitling, transcription, videography, voiceacting, webcasting, adaptation, archiving, soundscape,
`
  },
  {
    category: 'everyday',
    words: `
apartment, atmosphere, championship, characteristic, citizenship, community, decoration, destination, enthusiasm, generosity,
gratitude, happiness, harmony, heritage, household, humanity, humidity, kindness, lifestyle, livelihood,
marriage, opportunity, patience, personality, preference, privacy, relationship, resilience, responsibility, security,
sensitivity, simplicity, situation, sympathy, talent, temperature, tradition, understanding, unemployment, university,
variety, vehicle, victory, volunteer, weakness, wealth, weather, welcome, welfare, willingness,
workplace, writing, diary, novel, poetry, recipe,
`
  }
];
