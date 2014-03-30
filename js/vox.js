/**
 * Created by marcgille on 3/30/14.
 */

// Initialize module

if (!vox)
{
    var vox = {VoiceParser: VoiceParser};
}

/**
 *
 * @constructor
 */
function VoiceParser() {
    VoiceParser.prototype.initialize = function (tokens, productions, startProduction, start, error, end) {
        this.objects = [];
        this.links = [];
        this.context = null;

        this.tokens = tokens;
        this.grammar = productions;
        this.startProduction = startProduction;
        this.start = start;
        this.error = error;
        this.end = end;

        this.checkGrammar();
        this.initializeVoiceRecognition();
    };

    VoiceParser.prototype.checkGrammar = function () {
        var traverse = {};

        this.checkProduction(this.startProduction, traverse);
    };

    VoiceParser.prototype.checkProduction = function (production, traverse) {
        console.log("Checking production " + production);

        // Mark visited

        traverse[production] = this.grammar[production];

        for (var n = 0; n < this.grammar[production][0].length; ++n) {
            if (traverse[this.grammar[production][0][n][0]]) {
                continue;
            }

            if (this.grammar[this.grammar[production][0][n][0]]) {
                this.checkProduction(this.grammar[production][0][n][0], traverse);
            }
            else if (this.tokens[this.grammar[production][0][n][0]]) {
                continue;
            } else {
                throw "Incomplete Grammar: " + this.grammar[production][0][n][0] + " undefined.";
            }
        }
    };

    /**
     *
     * @returns {Array}
     */
    VoiceParser.prototype.getNextExpectedTokens = function () {
        var expectedTokens = [];
        var traverse = {};

        if (this.speechNode) {
            this.getNextExpectedTokenForProduction(this.speechNode.production, expectedTokens, traverse);
        }

        return expectedTokens;
    };

    /**
     * For (debugging) display.
     */
    VoiceParser.prototype.getActiveProductionsStack = function () {
        var speechNode = this.speechNode;
        var productions = [];

        while (speechNode)
        {
            productions.push(speechNode.production);

            speechNode = speechNode.parent;
        }

        return productions;
    };

    /**
     *
     * @param production
     * @param expectedTokens
     */
    VoiceParser.prototype.getNextExpectedTokenForProduction = function (production, expectedTokens, traverse) {
        if (traverse[production]) {
            return;
        }

        traverse[production] = production;

        for (var n = 0; n < this.grammar[production][0].length; ++n) {
            if (this.grammar[this.grammar[production][0][n][0]]) {
                this.getNextExpectedTokenForProduction(this.grammar[production][0][n][0], expectedTokens, traverse);
            }
            else if (this.tokens[this.grammar[production][0][n][0]]) {
                expectedTokens.push(this.tokens[this.grammar[production][0][n][0]]);
            }
            else {
                throw "Incomplete Grammar: " + this.grammar[production][0][n][0] + " undefined. Grammar not checked?";
            }
        }
    };

    /**
     *
     */
    VoiceParser.prototype.initializeVoiceRecognition = function () {
        this.recognition = new webkitSpeechRecognition();
        this.synthesis = window.speechSynthesis;

        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        var self = this;

        this.recognition.onstart = function () {
            self.start();
        };

        this.recognition.onerror = function (event) {
            self.error(event);
        };

        this.recognition.onend = function () {
            self.end();
        };

        this.recognition.onresult = function (event) {
            var interim_transcript = '';

            if (typeof(event.results) == 'undefined') {
                self.recognition.onend = null;
                self.recognition.stop();

                return;
            }

            for (var i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    var finalToken = event.results[i][0].transcript.trim().toUpperCase();

                    console.log("Final Transcript: [" + finalToken + "]");
                    console.log(self.tokens[finalToken]);
                    console.log(self.tokens);

                    if (self.tokens[finalToken]) {
                        if (self.finalTranscript.length > 0) {
                            self.processText(self.finalTranscript);
                        }

                        self.processToken(finalToken.toUpperCase());

                        self.finalTranscript = "";

                        self.nextTokenHint();
                    }
                    else {
                        self.finalTranscript += event.results[i][0].transcript;
                    }
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
        };
    };

    /**
     *
     */
    VoiceParser.prototype.nextTokenHint = function () {
        return;

        this.synthesis.speak(new SpeechSynthesisUtterance("Say one of the following "));

        var nextTokens = this.getNextExpectedTokens();

        for (var n = 0; n < nextTokens.length; ++n) {
            this.synthesis.speak(new SpeechSynthesisUtterance(nextTokens[0].label));
        }

    };

    /**
     *
     */
    VoiceParser.prototype.startRecognition = function () {
        if (this.recognizing) {
            this.recognition.stop();

            return;
        }

        this.finalTranscript = "";
        this.recognition.lang = "en-US";

        this.recognition.start();

        this.speechNode = null;

        this.pushProduction(this.startProduction);
        this.nextTokenHint();
    };

    /**
     *
     * @param transcript
     */
    VoiceParser.prototype.pushProduction = function (production) {
        console.log("Push production " + production);

        if (this.speechNode == null) {
            this.speechNode = {production: production, children: []};
        }
        else {
            var newSpeechNode = {production: production, children: [], parent: this.speechNode};

            this.speechNode.children.push(newSpeechNode);

            this.speechNode = newSpeechNode;
        }

        if (this.grammar[this.grammar[production][0][0][0]]) {
            this.pushProduction(this.grammar[production][0][0][0]);
        }
    };

    /**
     *
     */
    VoiceParser.prototype.popProduction = function () {
        var lastProduction = this.speechNode.production;
        this.speechNode = this.speechNode.parent;

        console.log("Speech Node");
        console.log(this.speechNode);

        console.log(this.productions);

        // Find popped production

        var currentProduction = this.grammar[this.speechNode.production][0]; // TODO Alternatives

        console.log(currentProduction);

        for (var n = 0; n < currentProduction.length; ++n) {
            if (currentProduction[n] == lastProduction) {
                // Process next production

                if (n < currentProduction.length - 1) {
                    this.pushProduction(currentProduction[n + 1]);
                } else {
                    // Current production completed

                    this.popProduction();
                }
            }
        }
    };

    /**
     *
     * @param transcript
     */
    VoiceParser.prototype.processText = function (text) {
        console.log("Process text: " + text);

        var production = this.grammar[this.speechNode.production];

        for (var n = 0; n < production[0].length; ++n) {
            if (production[0][n][0] == "TEXT") {
                this.speechNode.token = text;

                var action = production[0][n][1];

                this.popProduction();

                if (action) {
                    action(this.speechNode);
                }

                break;
            }
        }
    };

    /**
     *
     * @param transcript
     */
    VoiceParser.prototype.processToken = function (token) {
        console.log("Process token: " + token);

        var production = this.grammar[this.speechNode.production];

        for (var n = 0; n < production[0].length; ++n) {
            if (production[0][n][0] == token) {
                if (production[0][n][1]) {
                    this.speechNode.token = token;

                    var action = production[0][n][1];

                    this.popProduction();

                    if (action) {
                        action(this.speechNode);
                    }

                    break;
                }
            }
        }
    };
}