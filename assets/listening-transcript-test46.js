(function () {
    'use strict';

    var AUDIO_SOURCE = 'TEST 46.mp3';
    var transcript = [
        { part: 'Part 1' },
        { time: 0, text: 'Now turn to Section 1.' },
        { time: 12, text: 'You will hear a telephone conversation between a caller and a medical helpline adviser. First, you have some time to look at Questions 1 to 6.' },
        { time: 84, text: "Caller: Hello, I've got a problem with my back, and with it being the middle of the night, I can't go to the doctor, and I wonder if you can give me some advice. Adviser: Certainly. But first, can I have your telephone number, please? Caller: It's 03786 439 251." },
        { time: 108, text: "Adviser: OK. And if you could give me your first name, please? Caller: Robert. Adviser: And your surname? Caller: Ridyard. That's R-I-D-Y-A-R-D. Adviser: And now your address, please? Caller: It's 27 Station Road." },
        { time: 126, text: 'Adviser: OK. Moortown. And do you need the postcode? Caller: Yes, please. DP17 5HJ.' },
        { time: 134, text: 'Adviser: And your date of birth? Caller: The 25th of February, 1975. Adviser: Fine. Now I just need to take details of your doctor.' },
        { time: 144, text: "Caller: She's called Dr Craven. Adviser: And the surgery? Caller: It's Moortown Health Centre. Adviser: Thanks. Now, can you tell me a bit more about what the problem is? Caller: Well, like I said, it's my back. Adviser: OK. Can you tell me which part of the back? Caller: Lower." },
        { time: 160, text: "Adviser: And have you had any problems with your back before? Caller: Yes. I had a bit of trouble last year, in June, I think. Or was it July? No, we went on holiday at the beginning of July, and it had cleared up by then." },
        { time: 173, text: "Adviser: And when did it start this time? Has it just come on? Caller: No, I've had it, let's see, since Monday, so that's three days now. But it wasn't too bad at first. I mean, I could just about get around, though." },
        { time: 187, text: "Caller: I couldn't drive the car or anything. Then this afternoon, the pain suddenly got so bad that I went to bed. I've been in bed since, but that hasn't helped." },
        { time: 197, text: "Adviser: And do you have any pain elsewhere? In your stomach or abdomen, for example? Caller: No. Narrator: Before you hear the rest of the conversation, you have some time to look at Questions 7 to 10 on page 2. Now listen and answer Questions 7 to 10. Adviser: OK. Now, have you any idea what caused the problem? Caller: Well, I was tidying up my office, and I lifted a box up from the floor that was heavier than I thought, and I think that's what did it. Adviser: Yes, it's easily done, isn't it? So you're in bed now? Caller: Yes. Adviser: Have you tried applying heat to the back? Caller: Yes, I've got a hot-water bottle. That's usually the first thing I try. Adviser: And have you taken any painkillers? Caller: Yes. Adviser: And other than that, you feel quite well? Caller: I do, yes." },
        { time: 273, text: "Adviser: Right. Now, I can't diagnose or prescribe any medication, but I can offer you some advice. One thing you could do now is to see if ice makes any difference." },
        { time: 284, text: "Adviser: That sometimes helps. But don't put it directly onto your skin. Wrap it up in a towel or something." },
        { time: 290, text: "Adviser: And don't leave it on for longer than twenty minutes. Caller: Oh, right. I haven't tried that before." },
        { time: 295, text: "Adviser: It can be useful sometimes. Now, have you seen your doctor about this? Caller: No, I just thought, well, everyone has back pain, but I've never had it as bad as this before. Adviser: I think you should go and see your doctor tomorrow, and she may be able to give you something to help." },
        { time: 311, text: "Caller: OK, I'll do that. I'm actually feeling a bit better now. Adviser: Good. And you might get some advice from her about exercise. That's often the best way of dealing with this sort of problem. Caller: OK, I'll ask her." },
        { time: 323, text: "Adviser: Right. Now, if you're worried about anything before tomorrow, you can always phone back. Our lines are open twenty-four hours. Caller: Thanks very much." },
        { time: 331, text: 'Narrator: That is the end of Section 1. You now have half a minute to check your answers.' },

        { part: 'Part 2' },
        { time: 387, text: 'Narrator: Now turn to Section 2 on page 3. You will hear a principal of a school talking to a group of parents about a three-day trip for pupils to an outdoor education centre. First, you have some time to look at Questions 11 to 16. Now listen carefully and answer Questions 11 to 16.' },
        { time: 435, text: "Principal: Good evening. It's good to see so many parents here. Let me begin by explaining why we go to the outdoor education centre." },
        { time: 441, text: 'Well, by age ten, we feel the children are ready for a trip away from home, but still in a safe environment and under the guidance of a familiar adult.' },
        { time: 452, text: "At the school, we strongly believe children should be encouraged to try different things and not give up when it gets difficult. And that's what the centre is all about—having a go." },
        { time: 464, text: 'Anyway, to start with, the sleeping arrangements. For some children, this will be their first time in a tent and away from home, so please prepare them. You can do this just by making sure they have some early nights before we go.' },
        { time: 482, text: "Another thing: there's space for three children per tent, so we can't guarantee your child will be in with their best friends. So do make them aware of this." },
        { time: 492, text: 'Now, you should have received a list with the clothing the children will need in their backpack. But there are some extras. Please provide a packet of biscuits or maybe fruit bars. But these need to go in the box in the school hall, not with the children.' },
        { time: 509, text: "Actually, what we do need in the backpacks are bags for cleaning up and for wet clothing, so plastic ones, please. A torch is a good idea, but don't worry about putting money in because there's nothing to buy." },
        { time: 528, text: "While we're on the subject, let's talk about some other items. Cell phones are permitted, but they must be switched off at night and also off during the teaching sessions." },
        { time: 535, text: "Also, for wood-carving activities, knives will be provided by the centre, so children shouldn't bring them from home. Electronic games are banned, so rather than bring one of these, children should bring quiet board games." },
        { time: 552, text: "Turning to the question of parent attendance, in the past we've had too many volunteers, so we have written names on bits of paper and pulled them out of the box. But then some parents have changed their minds." },
        { time: 568, text: "So if you're absolutely sure you can come, put your name down on the sign-up form and the first ten will be asked to come. Experience isn't required; we just want you to lend a hand." },
        { time: 580, text: "Now, I'm afraid the fee for the trip needs to be paid by the fifteenth. Payment to the centre is made by the school, not by parents." },
        { time: 589, text: "And your teacher will be giving your child a form with the school's bank account details if you want to use them to make payment." },
        { time: 596, text: 'Otherwise, please leave payment in an envelope in the box at the school office.' },
        { time: 615, text: "Narrator: Before you hear the rest of the talk, you have some time to look at Questions 17 to 20. Now listen and answer Questions 17 to 20. Principal: Right. Let's have a look at the centre. I hope you all have a leaflet with a map on the back, and we'd like you to show this to your children before they go. Now, if you look at the map, you will see the entrance at the bottom. OK, so just through the entrance you'll see Reception." },
        { time: 641, text: "Now, the wood-carving studio. So you see where the main hall is located? Well, to the right of the hall and opposite the kitchen is the new barbecue area, and it's right next to that, overlooking Forest Road." },
        { time: 661, text: "It's crucial that children know where the emergency meeting point is. If you look to the top of the map and to the north of Forest Road, that's the location. It is on the same side of the river as the tents." },
        { time: 680, text: "There's a lot going on at the river—for example, the Conservation Centre. See the building marked Kayaks on the right-side riverbank? Well, the Conservation Centre is between the two bridges, just below it." },
        { time: 699, text: "I should also mention that if your child is not a confident swimmer, there are life jackets hanging all along the riverbank. If your child likes drawing and painting, the Arts and Crafts room is to the right of the river, a little further up from the kayaks. OK, so are there any questions so far?" },
        { time: 720, text: 'Narrator: That is the end of Section 2. You now have half a minute to check your answers.' },

        { part: 'Part 3' },
        { time: 747, text: 'Narrator: Now turn to Section 3. You will hear part of a discussion between two students, Liz from New Zealand and Scott from the UK, who are working on a presentation about a key historical site in New Zealand. First, you have some time to look at Questions 21 to 24. Now listen carefully and answer Questions 21 to 24.' },
        { time: 761, text: "Liz: Hi Scott, here are my notes. Scott: Let's sort this presentation out then. The first thing I found out about Stone Point is it's an extinct volcanic cone." },
        { time: 771, text: 'Scott: You probably know that already, being a New Zealander. Liz: Yes, and there are two other cones nearby which also overlook the harbour.' },
        { time: 779, text: "Liz: Yeah, the first settlers of New Zealand, the Māori, sailed to New Zealand thousands of years after these volcanoes erupted. I think the tutor allocated us this topic, though, because of Stone Point's significant historical role." },
        { time: 793, text: "Liz: It's been used by both Māori and European settlers as a place to shelter from attack or launch an attack for centuries." },
        { time: 802, text: 'Scott: Yeah, and the fact it was an ideal place for building a village—it would have been quite a sheltered spot. Liz: I suppose the Māori settled there because they thought the volcanic soil would help their crops grow.' },
        { time: 820, text: 'Scott: Well, they would have realised the benefits of the soil after a few good harvests, but initially the fishing opportunities would have been the attraction. Liz: You’re right.' },
        { time: 830, text: 'Scott: Actually, I also read that Māori regard Stone Point as taonga. I believe that means a treasured thing. Liz: Wow, your Māori vocabulary is improving, Scott.' },
        { time: 840, text: "Liz: We do have to deal with Stone Point's cultural value for Māori. That's still part of its historical significance." },
        { time: 851, text: "Liz: But we need to keep most Māori terminology out of the presentation; otherwise, a lot of the international students won't be able to follow us." },
        { time: 855, text: "Scott: That's a shame. I'm sure they'd be interested. I mean, I am. But, yeah, we wouldn't be able to explain it in the time allowed, so I guess we have to stick to English." },
        { time: 874, text: 'Scott: Anyway, European migrants turned Stone Point into a lookout point for ships. Then it became a fort, an army base in the late 1880s, and then, during the World Wars, the fort was modernised again. Liz: It’s also been a public park sometimes.' },
        { time: 886, text: "Scott: I'd prefer to devote more of the presentation to the military use of Stone Point. There are some great websites about the engines they installed. Liz: Sorry, I wouldn't go into the technical side if I were you. If you start describing mechanical stuff, people will switch off." },
        { time: 900, text: "Liz: I think it's more interesting to look at the impact Stone Point had on the people's lives at the time. I mean, for example, there were about twenty-five years when they used local prisoners to build the tunnels and the underground rooms. They lived there too." },
        { time: 914, text: "Scott: Yeah, I guess, if we can find some first-hand accounts. Liz: OK, so let's make a checklist of things to do." },
        { time: 928, text: "Liz: For the early Māori inhabitation section, we have to look at the material we've used again and make sure we know who the writers were and when they wrote it. Scott: Yes, that needs work." },
        { time: 950, text: "Scott: And for the part about Stone Point being used as a lookout point, I'm sure we can locate some drawings of how Stone Point looked then and the kind of ships coming in. Liz: Nice. And what else?" },
        { time: 967, text: "Liz: We haven't got a lot of detail for the reconstruction of the fort. We should add some more information about what it was the prisoners were adding to it. Scott: OK, I'll do that bit too." },
        { time: 984, text: "Liz: So I'll deal with the section regarding the modernisation that happened in the 1930s and 40s. I mean, that's the bit where we have the most visible evidence of historic buildings." },
        { time: 1002, text: "Liz: I'll ring the Department of Conservation and see if they'll agree to let me film the site—maybe allow me access to some of the tunnels the public don't see. Scott: OK." },
        { time: 1025, text: "Scott: For the 1950s onwards, could you also arrange a meeting with someone from the Department of Conservation to ask them about their restoration work? Liz: I could try." },
        { time: 1044, text: "Liz: Oh, and just about its use as a public park today—where is the boundary exactly? Does it go all the way to the beach? Scott: Not sure. I'll check that out. Liz: Great." },
        { time: 1062, text: 'Liz: I suppose it would finish off the presentation nicely if we explain the future plans for the site.' },
        { time: 1077, text: 'Narrator: That is the end of Section 3. You now have half a minute to check your answers.' },

        { part: 'Part 4' },
        { time: 1098, text: 'You will hear part of a lecture on rural development.' },
        { time: 1112, text: 'First, you have some time to look at Questions 31 to 40.' },
        { time: 1152, text: 'Lecturer: Good morning, everyone.' },
        { time: 1155, text: "Now, you'll remember that last week we looked at the migration of people from the interior of West Africa to various coastal towns, with special reference to Ghana." },
        { time: 1170, text: "Today we're going to focus on the people known as the Berbers, who live in North Africa." },
        { time: 1178, text: 'The Berbers inhabited this part of Africa as long ago as the seventh century, and their society was based on tribes which were scattered throughout a number of countries—Algeria, Morocco, Libya and Mali.' },
        { time: 1184, text: "However, at some point in the twelfth century, the area was invaded by Bedouin Arabs. These people destroyed the Berbers' peasant economy." },
        { time: 1193, text: 'As a result, many Berbers left their settlements to lead a nomadic life by wandering with their animals through the deserts and across the different mountains.' },
        { time: 1204, text: 'Over the centuries, many Berbers migrated to other countries like Spain and France to work as labourers, taking with them their culture and traditions, and their descendants remain there until this day.' },
        { time: 1217, text: 'Not all the Berbers led a fully nomadic life. There were three different groups.' },
        { time: 1223, text: 'Some became farmers, cultivating the lowlands in the winter and grazing their flocks of animals in the mountains during the summer. They are called seasonal nomads.' },
        { time: 1234, text: 'Some Berbers who led a completely nomadic life tended to move from one oasis to another.' },
        { time: 1240, text: 'A third group settled by the oases and grew fruit and vegetables like dates and eggplants, as well as making olive oil, which they used for cooking.' },
        { time: 1254, text: 'Traditionally, Berbers kept cattle, sheep and goats, together with oxen, mules and horses.' },
        { time: 1258, text: "Now, in the Sahel region of North Africa—that's the area south of the Sahara Desert—the region became, and still is becoming, increasingly dry and arid." },
        { time: 1267, text: 'So the Berbers relied more and more on camels for transporting their families and their goods.' },
        { time: 1275, text: 'How did these different groups of people survive in such harsh conditions? Where did they live? Well, Berbers who stayed put in one place built single-storey stone houses for protection by quarrying the local rock.' },
        { time: 1295, text: 'Whereas nomadic Berbers carried their homes with them and erected temporary tents, settled Berbers developed various small-scale industries such as pottery-making and weaving, but these tasks were generally left to the Berber women.' },
        { time: 1306, text: 'As you might expect, though, the life of a settled community was governed by the men, who met regularly in the village square to discuss affairs and make decisions.' },
        { time: 1328, text: "Now let's turn to the Tuaregs, who belonged to a nomadic Berber group and moved mainly in the central and western Sahara Desert, north of the River Niger. The word Tuareg comes from the Arabic Tawareq and means God-forsaken." },
        { time: 1338, text: 'Desert Tuaregs carried tents made of strips of goatskins sewn together. As many as forty skins were needed to make a complete tent.' },
        { time: 1350, text: "If the skins weren't available, they wove mats made of grass or palm leaves and hung them over a frame so that the tent looked like a humped dome." },
        { time: 1357, text: 'Tuareg society was traditionally very feudal and organised as a strict hierarchy, ranging from nobles or aristocrats downwards to labourers whose ancestors had once been slaves.' },
        { time: 1371, text: 'Tuaregs were famous for their warlike qualities and fierce independence. In fact, one of the greatest insults was to suggest to a Tuareg that his father had died in his bed and not while fighting.' },
        { time: 1386, text: 'Tuareg men were sometimes called blue men, as all adult males wore a dark blue veil in the presence of women, strangers and in-laws.' },
        { time: 1397, text: "Legend had it that a Tuareg man couldn't be recognised unless he was wearing this veil. But this custom began to disappear as more and more Tuaregs became urbanised and moved to the towns." },
        { time: 1408, text: 'I mentioned earlier how dry the Sahel region has become, and there have been very severe droughts over the past thirty years.' },
        { time: 1419, text: 'This has meant that the number of Tuaregs living in the area has declined.' },
        { time: 1427, text: 'Those whose animals were fortunate enough to survive have moved away from the southern Sahara into Burkina Faso in order to find new grazing lands for their herds.' },
        { time: 1431, text: "If there's one city which people associate with the Sahara Desert, it's probably Timbuktu. But what most people don't know is that Timbuktu was founded by Tuareg nomads almost a thousand years ago." },
        { time: 1451, text: 'The city became the focal point of the trans-Saharan caravan routes. North African merchants flocked there to do business, and trading in gold and salt flourished.' },
        { time: 1461, text: 'For many years, Timbuktu was considered inaccessible. But today, what is left of the city attracts a small number of tourists.' },
        { time: 1467, text: 'The tourism department of the Mali government employs some Tuaregs who act as guides.' },
        { time: 1480, text: "Essential, really, when you realise that it's only the Tuaregs who can find their way around the desert using the sand dunes as landmarks." },
        { time: 1492, text: "Right, I'll take questions now before I go on to discuss Tamasheq, the language spoken by the Tuaregs, which also has an alphabet called..." },
        { time: 1500, text: 'That is the end of Section 4.' }
    ];

    var answerHighlights = [
        { question: 1, phrase: 'Ridyard' },
        { question: 2, phrase: '27 Station Road', highlight: 'Station Road' },
        { question: 3, phrase: '25th of February', highlight: '25th of February' },
        { question: 4, phrase: 'Which part of the back? Caller: Lower', highlight: 'Lower' },
        { question: 5, phrase: "that's three days now", highlight: 'three days' },
        { question: 6, phrase: 'this afternoon', highlight: 'afternoon' },
        { question: 7, phrase: 'lifted a box', highlight: 'box' },
        { question: 8, phrase: 'painkillers' },
        { question: 9, phrase: 'ice makes any difference', highlight: 'ice' },
        { question: 10, phrase: 'advice from her about exercise', highlight: 'exercise' },
        { question: 11, phrase: 'try different things and not give up when it gets difficult' },
        { question: 12, phrase: 'early nights' },
        { question: 13, phrase: 'bags for cleaning up and for wet clothing, so plastic ones, please' },
        { question: 14, phrase: 'Cell phones are permitted' },
        { question: 15, phrase: 'The first ten will be asked to come' },
        { question: 16, phrase: 'box at the school office' },
        { question: 17, phrase: 'right next to that, overlooking Forest Road' },
        { question: 18, phrase: 'north of Forest Road' },
        { question: 19, phrase: 'between the two bridges' },
        { question: 20, phrase: 'to the right of the river, a little further up from the kayaks' },
        { question: 21, phrase: 'shelter from attack or launch an attack' },
        { question: 22, phrase: 'the fishing opportunities would have been the attraction' },
        { question: 23, phrase: 'we have to stick to English' },
        { question: 24, phrase: "impact Stone Point had on the people's lives" },
        { question: 25, phrase: 'make sure we know who the writers were and when they wrote it' },
        { question: 26, phrase: 'locate some drawings of how Stone Point looked' },
        { question: 27, phrase: 'add some more information about what it was the prisoners were adding to it' },
        { question: 28, phrase: 'agree to let me film the site' },
        { question: 29, phrase: 'arrange a meeting with someone from the Department of Conservation' },
        { question: 30, phrase: 'where is the boundary exactly' },
        { question: 31, phrase: 'through the deserts', highlight: 'deserts' },
        { question: 32, phrase: 'seasonal nomads', highlight: 'seasonal' },
        { question: 33, phrase: 'making olive oil', highlight: 'olive oil' },
        { question: 34, phrase: 'relied more and more on camels', highlight: 'camels' },
        { question: 35, phrase: 'village square', highlight: 'square' },
        { question: 36, phrase: 'mats made of grass', highlight: 'grass' },
        { question: 37, phrase: 'once been slaves', highlight: 'slaves' },
        { question: 38, phrase: 'dark blue veil', highlight: 'dark blue' },
        { question: 39, phrase: 'grazing lands for their herds', highlight: 'herds' },
        { question: 40, phrase: 'act as guides', highlight: 'guides' }
    ];

    var panel;
    var backdrop;
    var content;
    var toggle;
    var cues = [];
    var activeCue = null;
    var pendingSeek = null;

    function formatTime(totalSeconds) {
        var seconds = Math.max(0, Math.floor(totalSeconds));
        var minutes = Math.floor(seconds / 60);
        return minutes + ':' + String(seconds % 60).padStart(2, '0');
    }

    function appendAnswerHighlights(container, text) {
        var lowerText = text.toLowerCase();
        var ranges = [];

        answerHighlights.forEach(function (answer) {
            var phrase = answer.phrase.toLowerCase();
            var phraseStart = lowerText.indexOf(phrase);
            if (phraseStart === -1) return;

            var highlightedText = (answer.highlight || answer.phrase).toLowerCase();
            var relativeStart = phrase.indexOf(highlightedText);
            if (relativeStart === -1) return;

            var start = phraseStart + relativeStart;
            ranges.push({
                start: start,
                end: start + highlightedText.length,
                question: answer.question
            });
        });

        ranges.sort(function (left, right) {
            return left.start - right.start || left.end - right.end;
        });

        var cursor = 0;
        ranges.forEach(function (range) {
            if (range.start < cursor) return;
            if (range.start > cursor) {
                container.appendChild(document.createTextNode(text.slice(cursor, range.start)));
            }

            var mark = document.createElement('mark');
            mark.className = 'transcript-answer';
            mark.dataset.question = String(range.question);
            mark.title = 'Answer evidence for Question ' + range.question;
            mark.textContent = text.slice(range.start, range.end);
            container.appendChild(mark);
            cursor = range.end;
        });

        if (cursor < text.length) {
            container.appendChild(document.createTextNode(text.slice(cursor)));
        }
    }

    function getAudio() {
        return document.getElementById('testAudio');
    }

    function seekAndPlay(seconds) {
        var audio = getAudio();
        if (!audio) return;

        pendingSeek = seconds;

        function applySeek() {
            if (pendingSeek === null) return;
            var target = pendingSeek;
            pendingSeek = null;
            try {
                audio.currentTime = target;
            } catch (error) {
                pendingSeek = target;
                return;
            }
            var playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(function () {});
            }
        }

        if (!audio.getAttribute('src') && !audio.currentSrc) {
            audio.src = AUDIO_SOURCE;
            audio.load();
        }

        if (audio.readyState >= 1) {
            applySeek();
        } else {
            audio.addEventListener('loadedmetadata', applySeek, { once: true });
        }
    }

    function setActiveCue(cue, shouldScroll) {
        if (activeCue === cue) return;
        if (activeCue) activeCue.classList.remove('is-active');
        activeCue = cue;
        if (!activeCue) return;
        activeCue.classList.add('is-active');
        if (shouldScroll && panel.classList.contains('is-open')) {
            activeCue.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function syncActiveCue() {
        var audio = getAudio();
        if (!audio || !cues.length) return;
        var currentTime = Number(audio.currentTime) || 0;
        var match = cues[0];
        for (var i = 0; i < cues.length; i += 1) {
            if (Number(cues[i].dataset.time) <= currentTime) {
                match = cues[i];
            } else {
                break;
            }
        }
        setActiveCue(match, !audio.paused);
    }

    function openPanel() {
        panel.classList.add('is-open');
        backdrop.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('transcript-open');
        syncActiveCue();
        window.setTimeout(function () {
            panel.querySelector('.transcript-close').focus();
        }, 0);
    }

    function closePanel(returnFocus) {
        panel.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('transcript-open');
        if (returnFocus) toggle.focus();
    }

    function buildTranscript() {
        var audioBar = document.querySelector('.audio-controller-bar');
        if (!audioBar || document.getElementById('transcriptPanel46')) return;

        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'transcript-toggle';
        toggle.setAttribute('aria-controls', 'transcriptPanel46');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<i class="fas fa-align-left" aria-hidden="true"></i><span>Transcript</span>';
        audioBar.appendChild(toggle);

        backdrop = document.createElement('div');
        backdrop.className = 'transcript-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');

        panel = document.createElement('aside');
        panel.id = 'transcriptPanel46';
        panel.className = 'transcript-panel';
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('aria-label', 'Listening transcript');
        panel.innerHTML =
            '<div class="transcript-panel-header">' +
                '<h2 class="transcript-panel-title">Transcript</h2>' +
                '<button type="button" class="transcript-close" aria-label="Close transcript">&times;</button>' +
            '</div>' +
            '<div class="transcript-content"></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        content = panel.querySelector('.transcript-content');

        var answerKey = document.createElement('div');
        answerKey.className = 'transcript-answer-key';
        answerKey.innerHTML =
            '<span class="transcript-answer-key-swatch" aria-hidden="true"></span>' +
            '<span>Correct answer or answer evidence</span>';
        content.appendChild(answerKey);

        transcript.forEach(function (entry) {
            if (entry.part) {
                var heading = document.createElement('h3');
                heading.className = 'transcript-part-title';
                heading.textContent = entry.part;
                content.appendChild(heading);
                return;
            }

            var cue = document.createElement('button');
            cue.type = 'button';
            cue.className = 'transcript-cue';
            cue.dataset.time = String(entry.time);
            cue.setAttribute('aria-label', 'Play from ' + formatTime(entry.time) + '. ' + entry.text);
            cue.innerHTML =
                '<span class="transcript-time">' + formatTime(entry.time) + '</span>' +
                '<span class="transcript-cue-text"></span>';
            appendAnswerHighlights(cue.querySelector('.transcript-cue-text'), entry.text);
            cue.addEventListener('click', function () {
                setActiveCue(cue, false);
                seekAndPlay(entry.time);
            });
            cues.push(cue);
            content.appendChild(cue);
        });

        toggle.addEventListener('click', openPanel);
        backdrop.addEventListener('click', function () { closePanel(true); });
        panel.querySelector('.transcript-close').addEventListener('click', function () { closePanel(true); });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && panel.classList.contains('is-open')) {
                closePanel(true);
            }
        });

        var audio = getAudio();
        if (audio) {
            audio.addEventListener('timeupdate', syncActiveCue);
            audio.addEventListener('seeked', syncActiveCue);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildTranscript);
    } else {
        buildTranscript();
    }
})();
