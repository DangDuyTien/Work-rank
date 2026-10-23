'use strict';
const router = require('express').Router();
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/arcade.service');
const catalog = require('../services/gameCatalog.service');
const { ForbiddenError, ValidationError } = require('../utils/errors');
router.use(auth);
router.use((req, res, next) => {
  if (req.body && Buffer.byteLength(JSON.stringify(req.body), 'utf8') > 256000) return next(new ValidationError('Bản ghi lượt chơi quá lớn'));
  next();
});
router.get('/history', asyncHandler(async (req,res)=>res.json(await service.history(req.user.id,req.query))));
router.get('/active', asyncHandler(async (req, res) => res.json(await service.active(req.user.id))));
router.get('/rooms', asyncHandler(async (req, res) => res.json({ rooms: await service.list(req.query.gameType, req.query.mode) })));
router.get('/leaderboard', asyncHandler(async (req, res) => res.json(await service.leaderboard(req.query.gameType, req.query.mode || 'SOLO', req.query.period || 'all', req.user.id, req.query.difficulty || 'mixed'))));
router.post('/rooms', asyncHandler(async (req, res) => {
  const availability = await catalog.checkGameAvailability(req.body.gameType, req.user);
  if (!availability.allowed) throw new ForbiddenError(availability.message);
  res.status(201).json(await service.create(req.body, req.user));
}));
router.get('/rooms/:id', asyncHandler(async (req, res) => res.json(await service.detail(req.params.id, req.user.id))));
router.post('/rooms/:id/rematch', asyncHandler(async (req, res) => {
  const room = await require('../models').ArcadeRoom.findByPk(req.params.id);
  if (room) { const availability = await catalog.checkGameAvailability(room.gameType, req.user); if (!availability.allowed) throw new ForbiddenError(availability.message); }
  res.json(await service.rematch(req.params.id, req.user));
}));
for (const action of ['join', 'ready', 'team', 'start', 'progress', 'finish', 'leave']) {
  router.post(`/rooms/:id/${action}`, asyncHandler(async (req, res) => {
    const { id } = req.params, userId = req.user.id;
    if (action === 'join') {
      const detailRoom = await require('../models').ArcadeRoom.findByPk(id);
      if (detailRoom) { const availability = await catalog.checkGameAvailability(detailRoom.gameType, req.user); if (!availability.allowed) throw new ForbiddenError(availability.message); }
    }
    const result = action === 'join' ? await service.join(id, userId)
      : action === 'ready' ? await service.ready(id, userId, req.body.ready)
        : action === 'team' ? await service.switchTeam(id, userId, req.body.team)
          : action === 'start' ? await service.begin(id, userId)
            : action === 'leave' ? await service.leave(id, userId)
              : await service.sync(id, userId, req.body, action === 'finish');
    res.json(result);
  }));
}
module.exports = router;
