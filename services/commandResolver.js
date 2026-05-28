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