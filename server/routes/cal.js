/**
 * Cal.com webhook handler.
 * URL: https://oferty.soft-synergy.com/cal
 * Trigger: BOOKING_CREATED
 *
 * On booking: creates preliminary offer (oferta wstępna) with booking data.
 * Skips if an offer already exists for the attendee's email.
 */
const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Task = require('../models/Task');
const { upsertFollowUpTask } = require('../utils/followUpTasks');

const router = express.Router();

function getAdminUserId() {
  return User.findOne({ role: 'admin', isActive: true }).select('_id').lean()
    .then((u) => u?._id);
}

/**
 * Extract attendee email from Cal.com payload (primary booker).
 */
function getAttendeeEmail(payload) {
  const att = payload?.attendees?.[0];
  if (att?.email) return String(att.email).trim().toLowerCase();
  const resp = payload?.responses?.email;
  const val = typeof resp === 'object' ? resp?.value : resp;
  if (val) return String(val).trim().toLowerCase();
  return null;
}

/**
 * Extract client name from payload.
 */
function getClientName(payload) {
  const att = payload?.attendees?.[0];
  if (att?.name) return String(att.name).trim();
  const resp = payload?.responses?.name;
  const val = typeof resp === 'object' ? resp?.value : resp;
  if (val) return String(val).trim();
  if (att?.firstName || att?.lastName) {
    return [att.firstName, att.lastName].filter(Boolean).join(' ').trim();
  }
  return null;
}

/**
 * Extract phone from payload.
 */
function getPhone(payload) {
  const att = payload?.attendees?.[0];
  if (att?.phoneNumber) return String(att.phoneNumber).trim();
  const resp = payload?.responses?.attendeePhoneNumber;
  const val = typeof resp === 'object' ? resp?.value : resp;
  if (val) return String(val).trim();
  return null;
}

/**
 * Build consultation notes from additional notes + custom inputs.
 */
function getConsultationNotes(payload) {
  const parts = [];
  if (payload?.additionalNotes) parts.push(String(payload.additionalNotes).trim());
  const responses = payload?.responses;
  if (responses && typeof responses === 'object') {
    const notesResp = responses.notes;
    const notesVal = typeof notesResp === 'object' ? notesResp?.value : notesResp;
    if (notesVal) parts.push(String(notesVal).trim());
    const titleResp = responses.title;
    const titleVal = typeof titleResp === 'object' ? titleResp?.value : titleResp;
    if (titleVal) parts.push(`Temat spotkania: ${String(titleVal).trim()}`);
  }
  const custom = payload?.customInputs;
  if (custom && typeof custom === 'object') {
    Object.entries(custom).forEach(([k, v]) => {
      if (v != null && v !== '') parts.push(`${k}: ${String(v)}`);
    });
  }
  if (payload?.description) parts.push(String(payload.description).trim());
  return parts.filter(Boolean).join('\n\n') || 'Spotkanie z Cal.com';
}

/**
 * Build project name from event title and client.
 */
function getProjectName(payload, clientName) {
  const title = payload?.eventTitle || payload?.title;
  if (title && String(title).trim()) return String(title).trim();
  if (clientName) return `Konsultacja – ${clientName}`;
  return 'Konsultacja – Nowy klient';
}

// Cal.com POSTs to subscriber URL with JSON body
router.post('/', async (req, res) => {
  try {
    const { triggerEvent, payload } = req.body || {};
    if (triggerEvent !== 'BOOKING_CREATED') {
      return res.status(200).json({ ok: true, message: 'Event ignored', triggerEvent });
    }

    const email = getAttendeeEmail(payload);
    if (!email) {
      console.warn('[Cal.com webhook] No attendee email in payload');
      return res.status(200).json({ ok: true, message: 'No email in payload' });
    }

    // Check if offer already exists for this client email
    const existing = await Project.findOne({
      clientEmail: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).select('_id').lean();

    if (existing) {
      return res.status(200).json({ ok: true, message: 'Offer already exists for this email', skipped: true });
    }

    const clientName = getClientName(payload) || 'Klient (brak imienia)';
    const clientContact = clientName;
    const clientPhone = getPhone(payload) || null;
    const baseNotes = getConsultationNotes(payload);
    const bookingId = payload?.bookingId;
    const consultationNotes = baseNotes + (bookingId ? `\n\n[Cal.com booking #${bookingId}]` : '');
    const name = getProjectName(payload, clientName);

    const uid = payload?.uid;
    const bookerUrl = payload?.bookerUrl;
    const calBookingUrl = uid
      ? (bookerUrl ? `${String(bookerUrl).replace(/\/$/, '')}/booking/${uid}` : `https://app.cal.com/booking/${uid}`)
      : null;

    const adminId = await getAdminUserId();
    if (!adminId) {
      console.error('[Cal.com webhook] No admin user found');
      return res.status(500).json({ ok: false, message: 'No admin user' });
    }

    const project = new Project({
      name,
      clientName,
      clientContact,
      clientEmail: email,
      clientPhone: clientPhone || undefined,
      offerType: 'preliminary',
      status: 'draft',
      consultationNotes,
      calBookingUrl: calBookingUrl || undefined,
      modules: [{ name: 'Moduł do ustalenia', description: 'Szczegóły po konsultacji', color: 'blue' }],
      pricing: {
        phase1: 0,
        phase2: 0,
        phase3: 0,
        phase4: 0,
        total: 0
      },
      customPaymentTerms: 'Do ustalenia po konsultacji',
      createdBy: adminId,
      owner: adminId,
      changelog: [{
        action: 'create',
        fields: ['cal.com webhook'],
        author: adminId,
        createdAt: new Date()
      }]
    });

    await project.save();

    // Create meeting task
    try {
      const startTime = payload?.startTime || payload?.start || payload?.scheduledAt;
      const endTime = payload?.endTime || payload?.end;
      
      if (startTime) {
        const meetingDate = new Date(startTime);
        if (!isNaN(meetingDate.getTime())) {
          // Calculate time in minutes from midnight
          const hours = meetingDate.getHours();
          const minutes = meetingDate.getMinutes();
          const dueTimeMinutes = hours * 60 + minutes;
          
          // Calculate duration in minutes
          let durationMinutes = 30; // default
          if (endTime) {
            const endDate = new Date(endTime);
            if (!isNaN(endDate.getTime())) {
              durationMinutes = Math.max(15, Math.round((endDate.getTime() - meetingDate.getTime()) / (1000 * 60)));
            }
          }
          
          const meetingTask = new Task({
            title: `Spotkanie: ${clientName}`,
            description: `Spotkanie z Cal.com${calBookingUrl ? `\n\nLink: ${calBookingUrl}` : ''}${baseNotes ? `\n\nNotatki:\n${baseNotes}` : ''}`,
            status: 'todo',
            priority: 'high',
            assignees: [adminId],
            project: project._id,
            dueDate: meetingDate,
            dueTimeMinutes: dueTimeMinutes,
            durationMinutes: durationMinutes,
            createdBy: adminId,
            source: {
              kind: 'cal.com',
              refId: project._id
            }
          });
          
          await meetingTask.save();
          console.log(`[Cal.com webhook] Created meeting task for ${email} on ${meetingDate.toISOString()}`);
        }
      }
    } catch (e) {
      console.warn('[Cal.com webhook] Meeting task creation error:', e.message);
    }

    try {
      await upsertFollowUpTask(project, adminId);
    } catch (e) {
      console.warn('[Cal.com webhook] Follow-up task skip:', e.message);
    }

    try {
      await Activity.create({
        action: 'project.created',
        entityType: 'project',
        entityId: project._id,
        author: adminId,
        message: `Oferta wstępna z Cal.com: "${project.name}" (${email})`,
        metadata: { source: 'cal.com', bookingId: payload?.bookingId }
      });
    } catch (e) {}

    console.log(`[Cal.com webhook] Created preliminary offer "${project.name}" for ${email}`);
    return res.status(200).json({
      ok: true,
      message: 'Preliminary offer created',
      projectId: project._id.toString()
    });
  } catch (error) {
    console.error('[Cal.com webhook] Error:', error);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
