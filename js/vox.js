/**
 * Created by marcgille on 3/30/14.
 */

// Initialize module

if (!vox) {
    var vox = {VoiceParser: VoiceParser};
}

/**
 *
 * @constructor
 */
function VoiceParser() {
    /**
     *
     * @param tokens
     * @param productions
     * @param startProduction
     * @param start
     * @param error
     * @param end
     */
    VoiceParser.prototype.initialize = function (tokens, productions, startProduction, start, consume, error, end) {
        this.objects = [];
        this.links = [];
        this.context = null;

        this.tokens = tokens;
        this.grammar = productions;
        this.startProduction = startProduction;
        this.start = start;
        this.consume = consume;
        this.error = error;
        this.end = end;

        this.checkGrammar();
        this.initializeVoiceRecognition();
    };

    /**
     *
     */
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

                    console.log("Token Candidate: [" + finalToken + "]");

                    if (self.tokens[finalToken])
                    {
                        var matchingTokenNode = null;
                        var textTokenNode = null;

                        for (var n = 0; n < self.unresolvedTokenNodes.length; ++n)
                        {
                            if (self.unresolvedTokenNodes[n].token == "TEXT")
                            {
                                textTokenNode = self.unresolvedTokenNodes[n];
                            }
                            else if (self.unresolvedTokenNodes[n].token == finalToken)
                            {
                                matchingTokenNode = self.unresolvedTokenNodes[n];

                                break;
                            }
                        }

                        if (!matchingTokenNode)
                        {
                            if (textTokenNode)
                            {
                                // New token may have completed text input

                                if (self.finalTranscript.length > 0) {
                                    self.processText(self.finalTranscript);
                                    self.getUnresolvedTokenNodes();

                                    self.finalTranscript = "";
                                }

                                self.processToken(finalToken);
                                self.getUnresolvedTokenNodes();
                                self.consume();
                            }
                            else {
                                throw new SyntaxError("Unexpected token " + finalToken);
                            }
                        }
                        else if (self.finalTranscript.length == 0) // No other text parsed before
                        {
                            self.processToken(finalToken);
                            self.getUnresolvedTokenNodes();
                            self.consume();
                        }
                        else
                        {
                            throw new SyntaxError("Token " + finalToken + "interferes with text " + self.finalTranscript);
                        }
                    }
                    else
                    {
                        // Check whether parsing text is expected

                        var textTokenNode = null;

                        for (var n = 0; n < self.unresolvedTokenNodes.length; ++n)
                        {
                            if (self.unresolvedTokenNodes[n].token == "TEXT")
                            {
                                textTokenNode = self.unresolvedTokenNodes[n];

                                break;
                            }
                        }

                        if (textTokenNode) {
                            // Parsing free text; just append

                            self.finalTranscript += event.results[i][0].transcript;
                            self.consume();
                        }
                        else
                        {
                            throw new SyntaxError("Unexpected input " + event.results[i][0].transcript);
                        }
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
    VoiceParser.prototype.startRecognition = function () {
        if (this.recognizing) {
            this.recognition.stop();

            return;
        }

        this.finalTranscript = "";
        this.recognition.lang = "en-US";

        this.recognition.start();

        this.currentSpeechNode = null;
        this.rootSyntaxNode = null;

        this.pushProduction(this.rootSyntaxNode, this.startProduction, 0, 0);

        console.log(this.rootSyntaxNode);

        this.getUnresolvedTokenNodes();

        console.log(this.unresolvedTokenNodes);

        this.nextTokenHint();
    };

    /**
     *
     * @param transcript
     */
    VoiceParser.prototype.pushProduction = function (parentSyntaxNode, production, orIndex, andIndex) {
        console.log("Push production " + production);

        var newSyntaxNode = null;

        if (parentSyntaxNode == null) {
            newSyntaxNode = {production: production, orIndex: orIndex, andIndex: andIndex, children: [], resolved: false};

            this.rootSyntaxNode = newSyntaxNode;
        }
        else {
            newSyntaxNode = {production: production, orIndex: orIndex, andIndex: andIndex, children: [], parent: parentSyntaxNode, resolved: false};

            parentSyntaxNode.children.push(newSyntaxNode);
        }

        // Traverse grammar for all OR terms

        for (var n = 0; n < this.grammar[production].length; ++n) {
            if (this.grammar[this.grammar[production][n][0][0]]) {
                this.pushProduction(newSyntaxNode, this.grammar[production][n][0][0], n, 0);
            }
            else if (this.tokens[this.grammar[production][n][0][0]]) {
                this.pushToken(newSyntaxNode, this.grammar[production][n][0][0], n, 0);
            }
        }
    };

    /**
     *
     * @param transcript
     */
    VoiceParser.prototype.pushToken = function (parentSyntaxNode, token, orIndex, andIndex) {
        var newSyntaxNode = {token: token, orIndex: orIndex, andIndex: andIndex, parent: parentSyntaxNode, resolved: false};

        parentSyntaxNode.children.push(newSyntaxNode);
    };

    /**
     *
     * @returns {Array}
     */
    VoiceParser.prototype.getUnresolvedTokenNodes = function () {
        this.unresolvedTokenNodes = [];

        if (this.rootSyntaxNode) {
            this.getUnresolvedTokenNodesForProductionNode(this.rootSyntaxNode);
        }

        return this.unresolvedTokenNodes;
    };

    /**
     * Depth-first traversal of possible productions and expected next tokens.
     *
     * @param syntaxNode
     */
    VoiceParser.prototype.getUnresolvedTokenNodesForProductionNode = function (syntaxNode) {
        if (syntaxNode.resolved) {
            return;
        }

        // Iterate over OR terms

        for (var i = 0; i < syntaxNode.children.length; ++i) {
            if (syntaxNode.children[i].production) {
                // If term is a production, traverse

                this.getUnresolvedTokenNodesForProductionNode(syntaxNode.children[i]);
            }
            else if (syntaxNode.children[i].token) {
                // If term is token, add to expected tokens

                this.unresolvedTokenNodes.push(syntaxNode.children[i]);
            }
        }
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
    VoiceParser.prototype.resolveSyntaxBranch = function (syntaxNode) {
        // Find the first resolved node or root

        var lastSyntaxNode = null;
        var currentProduction = null;

        while (!lastSyntaxNode && syntaxNode.parent)
        {
            console.log(syntaxNode);

            syntaxNode.resolved = true;

            if (!lastSyntaxNode)
            {
                currentProduction = this.grammar[syntaxNode.parent.production];

                console.log("Syntax Node");
                console.log(syntaxNode);

                if (syntaxNode.andIndex < currentProduction[syntaxNode.orIndex].length - 1)
                {
                    lastSyntaxNode = syntaxNode;
                }
            }

            syntaxNode = syntaxNode.parent;
        }

        console.log("Last Syntax Node ");
        console.log(lastSyntaxNode);

        if (lastSyntaxNode)
        {
            console.log("Production");
            console.log(currentProduction);
            console.log(lastSyntaxNode.andIndex);

            this.deleteUnresolvedBranches(lastSyntaxNode);
            this.pushProduction(lastSyntaxNode.parent, currentProduction[lastSyntaxNode.orIndex][lastSyntaxNode.andIndex + 1], lastSyntaxNode.orIndex, lastSyntaxNode.andIndex + 1);
        }
        else
        {
            console.log("Parsing completed.");
        }
    };

    /**
     *
     */
    VoiceParser.prototype.deleteUnresolvedBranches = function (syntaxNode) {
        var children = [];

        if (syntaxNode.children) {
            for (var n = 0; n < syntaxNode.children.length; ++n) {
                if (syntaxNode.children[n].resolved) {
                    children.push(syntaxNode.children[n]);

                    // May be optimized as this is only needed for the branches not being cleaned yet

                    this.deleteUnresolvedBranches(syntaxNode.children[n]);
                }
            }

            syntaxNode.children = children;
        }
    };

        /**
     *
     * @param transcript
     */
    VoiceParser.prototype.processText = function (text) {
        console.log("Process text: " + text);

        for (var n = 0; n < this.unresolvedTokenNodes.length; ++n)
        {
            var tokenNode = this.unresolvedTokenNodes[n];

            if (tokenNode.token == "TEXT")
            {
                tokenNode.text = text;

                var parentProduction = this.grammar[tokenNode.parent.production];
                var action = parentProduction[tokenNode.orIndex][tokenNode.andIndex][1];

                this.resolveSyntaxBranch(tokenNode);

                if (action) {
                    action(this.tokenNode);
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

        for (var n = 0; n < this.unresolvedTokenNodes.length; ++n)
        {
            var tokenNode = this.unresolvedTokenNodes[n];

            if (tokenNode.token == token)
            {
                console.log("Found unresolved token");

                var parentProduction = this.grammar[tokenNode.parent.production];
                var action = parentProduction[tokenNode.orIndex][tokenNode.andIndex][1];

                this.resolveSyntaxBranch(tokenNode);

                if (action) {
                    action(this.tokenNode);
                }

                break;
            }
        }
   };
}