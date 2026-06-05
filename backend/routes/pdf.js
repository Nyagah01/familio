const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const supabase = require('../lib/supabase');

const NYAGAH_ID = '00000000-0000-0000-0000-000000000001';
const MUM_ID = '00000000-0000-0000-0000-000000000002';

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userName = userId === NYAGAH_ID ? 'Nyagah' : 'Mum';

    // Fetch history
    const { data: myTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('owner_id', userId)
      .in('status', ['done', 'cancelled', 'archived'])
      .neq('space', 'shared')
      .order('created_at', { ascending: false });

    const { data: sharedTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('space', 'shared')
      .in('status', ['done', 'cancelled', 'archived'])
      .order('created_at', { ascending: false });

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="familio-history-' + userName.toLowerCase() + '.pdf"');
    doc.pipe(res);

    // Header
    doc.fontSize(28).fillColor('#C8873A').font('Helvetica-Bold').text('Familio', 50, 50);
    doc.fontSize(12).fillColor('#666').font('Helvetica').text('Task History for ' + userName, 50, 85);
    doc.text('Generated ' + new Date().toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: 'numeric' }), 50, 102);
    doc.moveTo(50, 125).lineTo(545, 125).strokeColor('#E8E4DD').stroke();

    function drawSection(title, tasks, startY) {
      let y = startY;
      doc.fontSize(14).fillColor('#C8873A').font('Helvetica-Bold').text(title, 50, y);
      y += 25;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#C8873A').lineWidth(1).stroke();
      y += 10;

      if (!tasks || !tasks.length) {
        doc.fontSize(11).fillColor('#999').font('Helvetica-Oblique').text('No tasks yet.', 50, y);
        return y + 30;
      }

      tasks.forEach(function(t) {
        if (y > 720) { doc.addPage(); y = 50; }
        var isDone = t.status === 'done' || t.status === 'archived';
        var statusColor = isDone ? '#2D6A4F' : '#C0392B';
        var statusLabel = isDone ? 'Done' : 'Cancelled';
        var pts = isDone ? '+' + (t.points || 20) : '-' + (t.points_deducted || 0);
        var dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

        doc.fontSize(12).fillColor('#1a1209').font('Helvetica-Bold').text(t.title, 50, y, { width: 350 });
        doc.fontSize(10).fillColor(statusColor).font('Helvetica-Bold').text(statusLabel, 410, y);
        doc.fontSize(10).fillColor('#666').font('Helvetica').text(dateStr, 460, y);
        y += 18;

        if (t.cancel_reason) {
          doc.fontSize(10).fillColor('#C0392B').font('Helvetica-Oblique').text('Reason: ' + t.cancel_reason, 50, y, { width: 400 });
          y += 16;
        }

        doc.fontSize(10).fillColor('#C8873A').font('Helvetica-Bold').text(pts + ' pts', 50, y);
        y += 6;
        doc.moveTo(50, y).lineTo(545, y).strokeColor('#eee').lineWidth(0.5).stroke();
        y += 12;
      });

      return y + 10;
    }

    let y = 140;
    y = drawSection('My Tasks', myTasks, y);
    y = drawSection('Shared Tasks', sharedTasks, y + 10);

    doc.end();
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
