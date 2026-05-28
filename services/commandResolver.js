const resolveEngineCommand = (
    trackerModel,
    action
) => {

    if (!trackerModel) {

        throw new Error(
            "Tracker model missing"
        );
    }

    if (
        !trackerModel
            .supportsEngineControl
    ) {

        throw new Error(
            "Engine control unsupported"
        );
    }
    if (
        action === "stop" &&
        !trackerModel
            .engineStopCommand
    ) {

        throw new Error(
            "Engine stop command missing"
        );
    }

    if (
        action === "resume" &&
        !trackerModel
            .engineResumeCommand
    ) {

        throw new Error(
            "Engine resume command missing"
        );
    }
    if (action === "stop") {

        return {

            type:
                trackerModel.protocol,

            attributes: {

                data:
                    trackerModel
                        .engineStopCommand
            }
        };
    }

    return {

        type:
            trackerModel.protocol,

        attributes: {

            data:
                trackerModel
                    .engineResumeCommand
        }
    };
};

module.exports = {
    resolveEngineCommand
};