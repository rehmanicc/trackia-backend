const { addToQueue } =
    require("../services/positionQueue");

exports.receiveWebhook =
    async (req, res) => {

        try {
            console.log(
                "🔥 WEBHOOK HIT:",
                JSON.stringify(req.body)
            );

            const data = req.body;

            if (!data) {
                return res.sendStatus(400);
            }

            // 🔥 Traccar can send single or array
            const events =
                Array.isArray(data)
                    ? data
                    : [data];

            const normalized = [];

            for (const p of events) {

                // ignore invalid packets
                if (
                    !p.deviceId ||
                    !p.latitude ||
                    !p.longitude ||
                    !p.deviceTime
                ) {
                    continue;
                }

                normalized.push({

                    positionId:
                        p.id,

                    deviceId:
                        p.deviceId,

                    latitude:
                        Number(p.latitude),

                    longitude:
                        Number(p.longitude),

                    speed:
                        Number(p.speed) || 0,

                    course:
                        Number(p.course) || 0,

                    deviceTime:
                        p.deviceTime,

                    attributes:
                        p.attributes || {}

                });
            }

            if (normalized.length > 0) {

                addToQueue(normalized);

                console.log(
                    `🔥 Webhook positions: ${normalized.length}`
                );
            }

            res.sendStatus(200);

        } catch (err) {

            console.error(
                "❌ WEBHOOK ERROR:",
                err.message
            );

            res.sendStatus(500);
        }
    };