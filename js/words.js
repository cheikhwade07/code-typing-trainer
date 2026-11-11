// Words mode content: keybr-style letter unlocking with everyday and AI/ML words.
// All sentences below are original, written for this app (not copied from papers).
(function () {
  const CTT = (window.CTT = window.CTT || {});

  // English letter frequency order; the first START letters are unlocked at once so
  // real words work from the first lesson.
  const ORDER = 'etaoinsrhldcumfpgwybvkxjqz'.split('');
  const START = 10;

  // About 1,750 common everyday words and 600 words from AI/ML papers, written for this
  // app (not copied from a published frequency list).
  const COMMON = `you he it we they not be have do say get make go know take see come think look want give use find
tell ask work seem feel try leave call good new first last long great little own other old right big
high different small large next early young important few public bad same able because just very
really also well even back there still here now then only so too more most much many any some such
every each all both something nothing everything anything someone everyone people person man woman
women child children life day week year today time thing world school family group country problem
hand part place case point fact eye job way home water room mother area money story month lot book
word business issue side kind head house service friend father power hour game line end member law
car city name team minute idea body face others level office door health art history party result
change morning reason research girl guy moment air teacher force education yes okay sure maybe
probably already almost yet though although however never always often sometimes usually again
around against without within during before after until since while where why who what which how the
of and to in is that was for on are with as his at one this from or had by but can out were when up
your said an she their if will about them write would like these her him two has could did number
sound no my over than may down been made live round came show me our under through form sentence
help low turn cause mean move boy does set three play put read spell add land must follow act men
went light off need picture us animal near build self earth stand page should found answer grow
study learn plant cover food sun four between state keep let thought tree cross farm hard start
might saw far sea draw left late run press close night real north open together white begin become
talk hear believe hold bring happen provide sit lose pay meet include continue lead understand watch
stop create speak allow spend walk win offer remember love consider appear buy wait serve send
expect stay fall cut reach remain suggest raise pass sell require report decide pull explain hope
develop carry drive break receive agree support produce eat catch choose wish drop plan push fill
enjoy note join reduce thank enter share apply describe improve travel visit fix sing dance cook
clean wash dress sleep rest smile laugh worry mind piece sense view space street value rate past
half sort price matter type market control paper student class kid information center image care age
field role effect top language fire south sport board brother sister daughter son wife husband baby
course heart truth voice table hair shop cup bed letter chair window floor wall road bridge bus
plane boat bike ticket station hotel garden park beach island forest river lake hill town village
got example ease music those mark mile feet second took science began fish mountain once base horse
color wood main enough plain usual ready above ever red list bird soon dog direct song measure
product black short wind question complete ship rock order told knew whole king heard best better
true hundred five step west ground interest fast listen six less ten simple several toward lay
pattern slow map rain rule cold notice unit fine certain fly cry dark machine figure star box
correct pound done beauty stood contain front teach final gave green quick ocean warm free strong
special behind clear tail inch multiply wheel full blue object surface deep moon foot system busy
test record common gold possible dry wonder thousand ago ran check shape hot miss brought heat snow
tire distant east paint among national social local human easy recent personal single current wrong
private poor natural similar central happy serious general various entire nice huge popular modern
basic careful quiet loud soft cool fresh dirty empty heavy bright safe rich cheap expensive tall
wide thin thick sweet sour bitter strange normal perfect fair proud calm lucky famous favorite fun
funny glad pretty beautiful lovely silly smart wise brave gentle honest polite friendly useful
helpful exactly simply actually certainly finally clearly quickly slowly easily nearly mostly quite
rather perhaps instead either neither twice later ahead away tonight anyway else quote quality
quantity quarter queen equal square request unique technique frequency frequent equation liquid
squeeze acquire adequate inquiry quiz quest sequence subsequent consequence equivalent equipment joy
judge jump journal journey major project subject adjust jacket jar jelly jewel joke juice junior
jury justice reject objective majority joint jog jam jeans extra exact experience expert mix tax
text relax complex exist expand export express extend fox wax exercise excite excellent except
exchange exit sixty taxi axis maximum flexible explore extreme expense exceed excuse expose zero
size zone lazy prize freeze dozen puzzle buzz zoo zip maze amazing organize realize recognize
citizen breeze gaze jazz pizza blaze cozy magazine horizon zebra seize dizzy fuzzy apologize
memorize summarize analyze criticize emphasize valid verify vision evolve accept account across
activity address admit adult advice affect afford afraid afternoon agency agent aim alone along
alter amount announce annual another anybody anymore anyone anywhere apart apartment appeal apple
approach approve arm arrange arrive article artist aside asleep assume attach attempt attend
attitude audience aunt author autumn average avoid award aware background bag bake balance ball band
bank bar basket bath battery bear bedroom bee behave behavior belong below belt bench benefit beside
besides beyond bill bit blank blanket block bone bonus border boring born borrow boss bottle bottom
bowl brain branch brand bread breakfast breath brief broad brown brush budget bunch burn butter
button cake calendar camera camp campaign candle candy cap capital captain card career carpet cash
castle cat category ceiling celebrate cell cent century chain challenge champion chance channel
chapter character charge chart cheese chef chest chicken chief chip choice church circle claim
classic clever client climate climb clock cloth clothes cloud club coach coast coat code coffee coin
collect college comfort comment commit communicate compare compete complain concern concert
condition confirm connect consist contact content contest contract contrast convert cookie copy
corner cost cotton couch count couple courage cousin cream credit crew crowd culture curious curtain
custom customer cycle daily damage date deal dear debate decade declare decline define degree delay
deliver demand dentist deny depend deposit desert design desk detail device diet differ dinner
direction director disagree discover discuss dish display divide doctor document dollar double doubt
drama dream drink duck due duty eager ear earn edge editor effort egg eight elbow elect element
elevator eleven email emotion employ encourage energy engine engineer enormous entrance envelope
error escape essay estimate evening event evidence exam examine fabric factor factory fail faith
false fan fancy fashion fault fee fence festival fiction fifteen fifty file film filter finance
finger finish firm fit flag flat flavor flight float flood flower focus fold folk fond forget
forgive fork formal former fortune forty forward frame fridge fruit fuel fund furniture future gain
gap garage gas gate gather gift glass global goal golf grab grade grain grand grant grass gray greet
grocery guess guest guide guitar habit hall handle hang harbor hat healthy height hello hero hide
highway hire hobby holiday honey honor host hungry hurry ice ideal identify ignore imagine impact
income increase indeed indicate industry inform initial insect inside insist install instance intend
invite iron item kettle key kitchen kite knee knock knowledge label lack ladder lady lamp landscape
lane laptop laundry lawyer leader leaf league lean leather lecture lemon length lesson library
license lift limit link lion lip load loan lock lonely loose lunch mail maintain manage manner
margin marry mass master match material meal meaning meat media medicine medium melt memory mention
menu mess message metal method middle midnight milk million mirror mission mistake monitor mood
motor mouse mouth movie muscle museum mystery nail narrow nation native nature neat neck negative
nephew nerve nest net nine noise none noon nose novel nurse obey observe obtain obvious occasion
occur officer oil onion online operate opinion opportunity option orange ordinary organ origin
outcome outdoor outside oven owner pace pack package pair palace pan panel pants parent partner path
patient pause peace pear pen pencil penny pepper percent perform period permit pet phone photo
phrase physical pick pie pile pillow pilot pin pink pipe pitch plastic plate platform pleasant
please plenty pocket poem poet pole policy pool population port portion position positive post
potato pour practice praise prefer prepare present president pressure prevent pride primary prince
print priority process professor profit program progress promise proof proper property protect prove
publish pump purple purpose purse rabbit race radio range rare raw react recall recipe recommend
reflect refuse region regular relate release rely remove rent repair repeat replace reply represent
resource respond response restaurant return reveal review reward rice ride ring rise risk rival roll
roof root rope rough route routine row royal rubber rush sad salad salary salt sample sand satisfy
sauce save scale scene schedule score screen script search season seat secret section secure seed
select senior series session settle seven shade shadow shake shall sharp sheep sheet shelf shell
shift shine shirt shoe shopping shore shoulder shout shower sign signal silent silver site situation
skill skin sky slice slide slight slip smell smooth snack soap sock soil solid solution solve
somewhat sorry source speech speed spirit spot spread spring staff stage stair stamp standard steady
steel stick stomach stone storm stove strategy straw stream strength stress stretch string structure
studio stuff style succeed success sudden sugar suit summer sunny supply suppose surprise survey
sweater swim switch symbol talent target task taste tear tend tennis term theory thirsty thirteen
thirty throat throw thumb thus tie tiger tight tiny tip title toast toe toilet tomato tone tongue
tool tooth topic total touch tour towel tower toy track trade traffic trail transfer trash treat
trend trial trick trip trouble truck trust tune twelve twenty typical uncle unless unusual update
upper upset urban vacation valley vegetable vehicle version victory video visitor wage waist wake
wallet wander warn waste wave weak wealth wear weather wedding weekend weigh welcome wet wheat
whatever whenever whether whisper wild willing wing winner winter wire witness wooden wool worker
worth wrap wrist yard yellow yesterday yogurt youth aid bet cue dip dot era fog fry gym hop hut kit
lab lid mud mug nod nut oak odd owl rug`;

  const ML = `attention transformer token tokens layer layers model models train training trained loss gradient
gradients tensor tensors vector vectors matrix weight weights bias neuron neural network networks
encoder decoder embedding embeddings softmax dropout batch batches epoch epochs learning optimizer
momentum inference samples dataset data labels feature features input inputs output outputs hidden
states sequences positional heads query keys values scores norm residual linear activation sigmoid
kernel convolution pooling stride channels pixel images prior posterior likelihood probability
random variance median metric metrics accuracy precision errors function functions parameter
parameters estimator regression classifier classification cluster clustering boost boosting graph
node nodes edges beam greedy decode decoding generate generation prompt context cache retrieval
index agents action actions environment episode learner distill domain robust benchmark baseline
ablation scaling compute hardware parallel latent diffusion denoise variational autoencoder
contrastive pretrain finetune adapter alignment evaluation evaluate deploy server pipeline offline
split validation overfit underfit regularize sparse dense mixture experts routing chunk chunks
retrieve ranker rank ranking corpus vocabulary subword merge entropy divergence logits logit argmax
temperature nucleus sampling jitter projection jacobian optimize normalize tokenize quantize
quantized maximize minimize visualize queue approximate transformers tokenizer tokenization modeling
trainer pretrained pretraining finetuned finetuning losses matrices biases neurons encoders decoders
encode encoding embed batched minibatch optimizers optimization infer datasets labeled labeling
sequential queries normalization nonlinear nonlinearity activations kernels convolutional filters
pixels noisy probabilities probabilistic randomness parametric estimation classify clusters graphs
generative generator discriminator discriminative prompts prompting caching retriever indexing
agentic rewards policies episodes exploration exploitation distillation robustness benchmarks
baselines ablations parallelism latents denoising adapters aligned deployment serving pipelines
streaming overfitting underfitting regularization regularizer sparsity router chunking rerank
reranking corpora subwords merges sampler quantization quantizer quantile visualization perplexity
backprop backpropagation differentiable derivative derivatives stochastic deterministic heuristic
heuristics hyperparameter hyperparameters sweep scheduler warmup decay annealing cosine checkpoint
checkpoints checkpointing throughput latency bandwidth accelerator accelerators distributed shard
sharding replica replicas synchronous asynchronous integer pruning prune pruned compression compress
factorization decomposition eigenvalue eigenvalues eigenvector eigenvectors singular orthogonal
covariance correlation correlated logistic polynomial convex nonconvex convergence converge diverge
descent ascent minima maxima saddle plateau curvature iteration iterations iterative recursive
recurrent recurrence feedforward multilayer perceptron backbone architecture architectures module
modules bottleneck upsample upsampling downsample downsampling dilation dilated padding mask masked
masking causal autoregressive bidirectional supervised unsupervised semisupervised supervision
annotation annotations annotator annotators augmentation augment augmented synthetic simulation
simulator imitation demonstrations trajectory trajectories rollout rollouts critic actor bootstrap
bootstrapping discount bandit bandits regret preference preferences pairwise calibration calibrated
uncertainty confidence hypothesis significance statistical statistics distribution distributions
marginal conditional independent amortized lower bound bounds generalization generalize memorization
capacity expressive expressivity interpretability interpretable explainability explainable saliency
attribution probing probe probes circuit circuits mechanistic superposition steering hallucination
hallucinate grounding grounded factuality reasoning planning planner instruction instructions
multimodal modality modalities caption captioning segmentation detection detector recognition entity
entities relation triplet similarity distance nearest neighbor neighbors vectorize vectorized lookup
hashing bucket buckets inverted lexical semantic semantics syntactic parsing parser tagging
summarization sentiment adversarial perturbation perturbations privacy federated differential
clipping exploding vanishing initialization initialize ensemble ensembles bagging stacking holdout
stratified imbalance imbalanced oversample undersample weighting threshold thresholds specificity
sensitivity histogram telemetry drift retraining reproducible reproducibility seeds leaderboard
evaluator rubric scorer emergent emergence curation deduplication unigram bigram rotary sinusoidal
extrapolation interpolation fused compiler profiler profiling batching speculative verifier
verification solver discrete continuous resolution patches prefix suffix endpoint orchestration
workload matmul broadcast broadcasting reshape transpose concatenate scatter reduction
dimensionality dimension dimensions manifold subspace hyperplane logarithm exponential quadratic
scalar scalars affine bilinear gating gated downstream upstream frozen pointwise elementwise
contextual contextualized contamination leakage multitask multilingual quantitative qualitative
invariant invariance aggregation adjacency adjacent conjugate jointly regularized normalized
optimized tokenized generalizes initialized serialize stabilize discretize randomize randomized
vectorization`;

  const SENTENCES = [
    'The encoder reads the whole input before the decoder writes a single token.',
    'Each attention head learns to look at a different part of the sequence.',
    'We scale the dot products so the softmax does not saturate.',
    'Residual connections let the gradient flow through many layers.',
    'Dropout turns off random units during training to reduce overfitting.',
    'A larger batch gives a smoother gradient but uses more memory.',
    'The learning rate warms up slowly and then decays over time.',
    'Positional signals tell the model where each token sits in the sentence.',
    'The loss on the validation split stopped falling after the third epoch.',
    'We report the mean and the variance over five random seeds.',
    'An ablation shows which part of the model actually matters.',
    'The baseline is simple, but it is surprisingly hard to beat.',
    'Retrieval adds fresh context that the model never saw in training.',
    'A short prompt can change the behavior of a large language model.',
    'Beam search keeps several partial answers and extends the best ones.',
    'Greedy decoding is fast, but it can miss a better sequence.',
    'Temperature controls how random the sampled tokens are.',
    'The embedding table maps every token to a dense vector.',
    'Layer normalization keeps the activations in a stable range.',
    'The optimizer keeps a running average of past gradients.',
    'Weight decay pulls large parameters back toward zero.',
    'A confusion matrix shows which classes the classifier mixes up.',
    'Precision asks how many predicted positives were right.',
    'Recall asks how many real positives the model found.',
    'Cross entropy measures how far the prediction is from the label.',
    'The model overfits when it memorizes the training set.',
    'More data often helps more than a bigger model.',
    'We freeze the encoder and finetune only the last layer.',
    'A small adapter can specialize a large model for a new task.',
    'Distillation trains a small student to copy a large teacher.',
    'Contrastive learning pulls similar pairs together and pushes others apart.',
    'The latent space places similar inputs close to each other.',
    'Diffusion models learn to remove noise one small step at a time.',
    'An autoencoder compresses the input and then rebuilds it.',
    'The reward tells the agent how good its last action was.',
    'The policy maps each state of the environment to an action.',
    'Exploration helps the agent find rewards it has never seen.',
    'Sparse experts let each token use only part of the network.',
    'A router decides which expert should process each token.',
    'Caching past keys and values makes decoding much faster.',
    'Long contexts cost more memory because attention grows with length.',
    'We split long documents into chunks before indexing them.',
    'The ranker sorts the retrieved passages by relevance.',
    'A held out test set gives an honest estimate of real accuracy.',
    'Cross validation reuses the data by rotating the test fold.',
    'Gradient clipping stops a single bad batch from ruining training.',
    'Mixed precision training uses less memory and runs faster.',
    'Data parallel training copies the model to every device.',
    'The scaling curve shows loss falling as compute grows.',
    'Evaluation should match the way the model will be used.',
    'A robust model keeps working when the input distribution shifts.',
    'Label noise makes even a perfect model look worse than it is.',
    'Feature scaling helps gradient descent converge faster.',
    'A decision tree splits the data on one feature at a time.',
    'A random forest averages many trees to reduce variance.',
    'Boosting adds weak learners that fix the errors of earlier ones.',
    'Support vector machines look for the widest possible margin.',
    'Clustering groups points without using any labels.',
    'Regularization trades a little bias for much lower variance.',
    'The kernel trick lets a linear model learn curved boundaries.',
    'Convolution shares the same filter across every part of the image.',
    'Pooling reduces the size of the feature map.',
    'A stride of two halves the width and the height.',
    'Graph networks pass messages along the edges between nodes.',
    'The tokenizer breaks rare words into smaller subword pieces.',
    'A bigger vocabulary means shorter sequences but a larger embedding table.',
    'Perplexity is lower when the model is less surprised by the text.',
    'The logits become probabilities after the softmax.',
    'Argmax picks the single most likely class.',
    'Nucleus sampling keeps only the smallest set of likely tokens.',
    'Alignment work tries to make models helpful and honest.',
    'Benchmarks age quickly once models are trained on similar data.',
    'A careful error analysis often beats another round of tuning.',
    'Start with a simple model and add complexity only when it helps.',
    'Log every experiment so a result can be reproduced later.',
    'Check the data pipeline before blaming the model.',
    'Plot the training curve; numbers alone can hide a problem.',
    'Inference cost matters as much as accuracy in production.',
    'Online evaluation shows how the model behaves with real users.',
    'A model is only as good as the data it learned from.',
    'Attention lets every token gather information from every other token.',
    'Multi head attention runs several attention functions in parallel.',
    'The feed forward block is applied to each position on its own.',
    'Masking stops the decoder from reading future tokens.',
    'Teacher forcing feeds the true previous token during training.',
    'The value vectors are mixed using the attention weights.',
    'Queries and keys decide how much each position attends to another.',
    'Pretraining on a large corpus gives the model broad knowledge.',
    'Finetuning on a small labeled set adapts it to one task.',
    'A good metric rewards what we actually care about.',
    'Early stopping ends training when validation loss rises again.',
    'Batch normalization uses statistics from the current batch.',
    'The hidden state carries information from earlier steps.',
    'Vanishing gradients made deep recurrent networks hard to train.',
    'Skip connections made very deep networks practical.',
    'Variance across seeds can be larger than the gain we report.',
    'Every chart should say what the axes mean.',
    'Small, clean experiments teach more than one huge run.',
    'Read the error before you change the code.',
    'Ship the simple version first, then measure what to improve.',
  ];

  const WORDS = [...new Set((COMMON + ' ' + ML).split(/\s+/).filter((w) => /^[a-z]+$/.test(w)))];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Optional extras for word lessons (Settings → Words). They are typed and count in the
  // lesson's speed and accuracy, but only lowercase a-z is recorded in the letter stats.
  const CAPS_RATE = [0, 0.15, 0.4]; // caps: off, sometimes, often
  const NUM_RATE = 0.12; // chance of a number before a word
  const PUNCT_RATE = 0.15; // chance of punctuation after a word
  const NUMBERS = ['2', '3', '4', '5', '7', '8', '10', '12', '16', '32', '42', '64', '95', '99', '100', '128', '256',
    '512', '1000', '1024', '2048', '2026', '0.1', '0.5', '0.9', '0.01', '3.5', '1.0'];
  const PUNCT = [',', ',', ',', '.', '.', '?', ';', ':'];

  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

  function decorate(list, opts) {
    const capRate = CAPS_RATE[opts.caps] || 0;
    const out = [];
    let sentenceStart = false;
    for (let i = 0; i < list.length; i++) {
      if (opts.nums && Math.random() < NUM_RATE) { // always followed by a word, so never two in a row
        out.push(pick(NUMBERS));
        sentenceStart = false;
      }
      let w = list[i];
      if (capRate && (sentenceStart || Math.random() < capRate)) w = cap(w);
      sentenceStart = false;
      if (opts.punct && i < list.length - 1 && Math.random() < PUNCT_RATE) {
        const p = pick(PUNCT);
        w += p;
        sentenceStart = p === '.' || p === '?';
      }
      out.push(w);
    }
    if (opts.punct && out.length && !/[.?]$/.test(out[out.length - 1])) out[out.length - 1] += '.';
    return out;
  }

  // Lesson text. unlocked: letters allowed; plan: { focus, secondary } from ENGINE.plan;
  // length: target characters; sentences: true for a sentence lesson (all letters unlocked);
  // opts: { caps: 0|1|2, nums, punct } (word lessons only; sentences keep their own form).
  function text(unlocked, plan, length, sentences, opts) {
    length = Math.max(20, length || 70);
    if (sentences) {
      const out = [];
      let size = 0;
      let guard = 0;
      while (size < length && guard++ < 50) {
        const s = pick(SENTENCES);
        if (out.length && out[out.length - 1] === s) continue;
        out.push(s);
        size += s.length + 1;
      }
      return out.join(' ');
    }
    const set = new Set(unlocked);
    const usable = WORDS.filter((w) => [...w].every((c) => set.has(c)));
    const focus = plan && plan.focus;
    const withFocus = focus ? usable.filter((w) => w.includes(focus)) : [];
    const sec = ((plan && plan.secondary) || []).filter((c) => set.has(c));
    const withSec = sec.length ? usable.filter((w) => sec.some((c) => w.includes(c))) : [];
    const out = [];
    let size = 0;
    let guard = 0;
    while (size < length && guard++ < 500) {
      const r = Math.random();
      let pool = usable;
      if (withFocus.length && r < 0.5) pool = withFocus;
      else if (withSec.length && r < 0.8) pool = withSec;
      let w = pool.length ? pick(pool) : fakeWord(unlocked, focus);
      if (out.length && out[out.length - 1] === w) {
        if (pool.length < 2) w = fakeWord(unlocked, focus);
        else continue;
      }
      out.push(w);
      size += w.length + 1;
    }
    return (opts && (opts.caps || opts.nums || opts.punct) ? decorate(out, opts) : out).join(' ');
  }

  // Fallback when no real word fits (should not happen with 10+ starting letters).
  function fakeWord(unlocked, focus) {
    const n = 3 + Math.floor(Math.random() * 3);
    let w = focus || '';
    while (w.length < n) w += pick(unlocked);
    return w;
  }

  CTT.WORDS = { ORDER, START, WORDS, SENTENCES, text };
})();
