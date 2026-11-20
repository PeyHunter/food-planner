import { packOf, type Pack } from "./grocery-packs.ts";
import type { ShopSection } from "./recipes.ts";

/**
 * One thing you can buy. Names are singular; the first Danish name is the one a Danish shop search uses.
 * `pack` is how Danish shops sell it, when known (see docs/research/danish-pack-sizes.md).
 */
export type Grocery = { en: string[]; da: string[]; section: ShopSection; pack?: Pack };

// [English names, Danish names], comma separated. Irregular Danish plurals are listed as names of their own.
const table: Record<ShopSection, [string, string][]> = {
  Vegetables: [
    ["potato", "kartoffel, kartofler"],
    ["new potato, baby potato", "nye kartofler, nye kartoffel"],
    ["sweet potato", "sødkartoffel, sødkartofler, søde kartofler"],
    ["onion, yellow onion, brown onion", "løg, gule løg"],
    ["red onion", "rødløg, røde løg"],
    ["spring onion, scallion, green onion", "forårsløg"],
    ["shallot", "skalotteløg"],
    ["leek", "porre, porrer, porreløg"],
    ["garlic, garlic clove, clove of garlic, garlic bulb", "hvidløg, hvidløgsfed"],
    ["carrot", "gulerod, gulerødder"],
    ["tomato, vine tomato, beef tomato", "tomat"],
    ["cherry tomato", "cherrytomat, cocktailtomat"],
    ["cucumber", "agurk"],
    ["pepper, bell pepper, red pepper, green pepper, yellow pepper", "peberfrugt, rød peberfrugt"],
    ["chilli, chili, chilli pepper, red chilli, green chilli, jalapeno", "chili, chilipeber, rød chili, chilifrugt"],
    ["courgette, zucchini", "squash, courgette"],
    ["aubergine, eggplant", "aubergine"],
    ["broccoli, tenderstem broccoli", "broccoli, broccolini"],
    ["cauliflower", "blomkål"],
    ["cabbage, white cabbage", "hvidkål, kål"],
    ["red cabbage", "rødkål"],
    ["pointed cabbage, sweetheart cabbage", "spidskål"],
    ["savoy cabbage", "savojkål"],
    ["brussels sprout", "rosenkål"],
    ["kale", "grønkål"],
    ["pak choi, bok choy", "pak choi, kinakål"],
    ["spinach, baby spinach", "spinat, babyspinat"],
    ["lettuce, iceberg lettuce, romaine lettuce, little gem", "salat, icebergsalat, hjertesalat, romainesalat, salathoved"],
    ["salad leaves, mixed salad, salad", "salatblanding, blandet salat"],
    ["rocket, arugula", "rucola"],
    ["watercress, cress", "karse, brøndkarse"],
    ["celery, celery stick", "bladselleri, stilkselleri"],
    ["celeriac", "knoldselleri, selleri"],
    ["parsnip", "pastinak"],
    ["parsley root", "persillerod, persillerødder"],
    ["beetroot, beet", "rødbede"],
    ["turnip, swede", "majroe, kålroe"],
    ["jerusalem artichoke", "jordskok"],
    ["radish", "radise"],
    ["fennel", "fennikel"],
    ["pumpkin", "græskar, hokkaido"],
    ["butternut squash, butternut", "butternutsquash, butternut"],
    ["mushroom, button mushroom, chestnut mushroom", "champignon, svamp, svampe"],
    ["oyster mushroom", "østershat"],
    ["portobello mushroom, portobello", "portobello"],
    ["sweetcorn, corn on the cob, corn", "majskolbe, majs"],
    ["green bean, french bean, runner bean", "grøn bønne, grønne bønner, haricots verts"],
    ["sugar snap pea, mangetout, snow pea", "sukkerært, sukkerærter"],
    ["asparagus, green asparagus, white asparagus", "asparges, grønne asparges, hvide asparges"],
    ["avocado", "avocado"],
    ["ginger, fresh ginger, ginger root", "ingefær"],
    ["lemongrass", "citrongræs"],
    ["bean sprout", "bønnespire, bønnespirer"],
    ["parsley, flat-leaf parsley, curly parsley", "persille, bredbladet persille, kruspersille"],
    ["coriander, cilantro, fresh coriander", "koriander, frisk koriander"],
    ["basil", "basilikum"],
    ["dill", "dild"],
    ["chive", "purløg"],
    ["mint", "mynte"],
    ["thyme", "timian"],
    ["rosemary", "rosmarin"],
    ["sage", "salvie"],
    ["tarragon", "estragon"],
    ["herb, fresh herb", "krydderurt, krydderurter, friske krydderurter"],
    ["lemon", "citron"],
    ["lime", "lime"],
    ["apple", "æble"],
    ["pear", "pære"],
    ["banana", "banan"],
    ["orange", "appelsin"],
    ["clementine, mandarin, satsuma", "klementin, mandarin"],
    ["grape", "vindrue, drue"],
    ["strawberry", "jordbær"],
    ["blueberry", "blåbær"],
    ["raspberry", "hindbær"],
    ["blackberry", "brombær"],
    ["berry, mixed berry", "bær"],
    ["cherry", "kirsebær"],
    ["plum", "blomme"],
    ["peach", "fersken"],
    ["nectarine", "nektarin"],
    ["apricot", "abrikos"],
    ["mango", "mango"],
    ["pineapple", "ananas"],
    ["melon, watermelon, honeydew melon", "melon, vandmelon"],
    ["kiwi", "kiwi"],
    ["pomegranate", "granatæble"],
    ["fig", "figen"],
    ["passion fruit", "passionsfrugt"],
    ["rhubarb", "rabarber"],
    ["grapefruit", "grapefrugt"],
    ["fruit", "frugt"],
    ["vegetable", "grøntsag"],
  ],
  Bread: [
    ["bread, loaf", "brød"],
    ["rye bread", "rugbrød"],
    ["white bread, sandwich bread, toast", "franskbrød, toastbrød"],
    ["wholemeal bread", "fuldkornsbrød"],
    ["sourdough bread, sourdough", "surdejsbrød"],
    ["bread roll, roll, bun", "bolle, rundstykke, boller"],
    ["baguette", "flute, baguette"],
    ["pitta bread, pita bread, pitta, pita", "pitabrød, pita"],
    ["naan bread, naan", "naanbrød, naan"],
    ["tortilla, wrap, flour tortilla", "tortilla, wrap"],
    ["burger bun", "burgerbolle, burgerboller"],
    ["hot dog bun", "pølsebrød"],
    ["crispbread", "knækbrød"],
    ["croissant", "croissant"],
    ["danish pastry", "wienerbrød, snegl"],
    ["cake", "kage"],
  ],
  Dairy: [
    ["milk, whole milk, semi-skimmed milk, skimmed milk", "mælk, letmælk, sødmælk, minimælk, skummetmælk"],
    ["buttermilk", "kærnemælk"],
    ["cream, double cream, whipping cream, heavy cream", "fløde, piskefløde"],
    ["single cream, cooking cream", "madlavningsfløde, kaffefløde"],
    ["creme fraiche, crème fraîche, sour cream", "creme fraiche, cremefraiche, crème fraîche"],
    ["butter", "smør"],
    ["margarine", "margarine, plantemargarine"],
    ["cheese", "ost"],
    ["grated cheese", "revet ost"],
    ["cheddar", "cheddar"],
    ["parmesan", "parmesan, parmesanost"],
    ["mozzarella", "mozzarella"],
    ["feta", "feta, fetaost"],
    ["halloumi", "halloumi"],
    ["ricotta", "ricotta"],
    ["mascarpone", "mascarpone"],
    ["cream cheese", "flødeost, smøreost"],
    ["cottage cheese", "hytteost"],
    ["goat cheese, goat's cheese", "gedeost"],
    ["blue cheese", "blåskimmelost"],
    ["brie", "brie"],
    ["yoghurt, yogurt, natural yoghurt", "yoghurt, yoghurt naturel"],
    ["greek yoghurt, greek yogurt", "græsk yoghurt"],
    ["skyr", "skyr"],
    ["quark", "kvark"],
    ["egg", "æg"],
    ["egg yolk", "æggeblomme"],
    ["egg white", "æggehvide"],
    ["oat milk, oat drink", "havredrik, havremælk"],
    ["almond milk", "mandeldrik, mandelmælk"],
    ["soy milk", "sojadrik, sojamælk"],
    ["tofu", "tofu"],
    ["hummus", "hummus"],
    ["pizza dough", "pizzadej"],
    ["fresh pasta", "frisk pasta"],
  ],
  "Meat & fish": [
    ["chicken, whole chicken", "kylling, hel kylling"],
    ["chicken breast, chicken fillet", "kyllingebryst, kyllingefilet, kyllingebrystfilet, kyllingeinderfilet"],
    ["chicken thigh", "kyllingelår, kyllingeoverlår, overlår"],
    ["chicken drumstick, drumstick", "kyllingeunderlår, underlår"],
    ["chicken wing", "kyllingevinge, kyllingevinger"],
    ["minced chicken, chicken mince", "hakket kylling, kyllingefars, kyllingekød"],
    ["turkey, turkey breast", "kalkun, kalkunbryst"],
    ["beef", "oksekød"],
    ["minced beef, beef mince, ground beef, mince", "hakket oksekød, oksefars, hakkekød, fars"],
    ["steak, beef steak, rump steak, sirloin", "bøf, steak, entrecote, ribeye, culotte"],
    ["beef tenderloin, fillet steak", "oksemørbrad, mørbrad"],
    ["roast beef, beef roast", "roastbeef, oksesteg"],
    ["stewing beef, braising steak", "grydesteg, oksetykkeam, okseskank"],
    ["veal", "kalvekød, kalv"],
    ["minced veal and pork, pork and veal mince", "hakket kalv og flæsk, kalv og flæsk, hakket svine- og kalvekød"],
    ["pork", "svinekød, gris"],
    ["minced pork, pork mince", "hakket svinekød, svinefars"],
    ["pork chop", "svinekotelet, kotelet, koteletter"],
    ["pork tenderloin, pork fillet", "svinemørbrad"],
    ["pork belly", "flæsk, stegeflæsk, svinebryst"],
    ["roast pork", "flæskesteg"],
    ["pork neck", "nakkefilet, svinenakke"],
    ["bacon, bacon lardons, lardons", "bacon, baconskiver, bacontern"],
    ["ham", "skinke, hamburgerryg"],
    ["sausage", "pølse, pølser"],
    ["chorizo", "chorizo"],
    ["salami, pepperoni", "salami, spegepølse, pepperoni"],
    ["liver pâté", "leverpostej"],
    ["cold cuts, sliced meat", "pålæg"],
    ["lamb", "lam, lammekød"],
    ["minced lamb, lamb mince", "hakket lam, lammefars"],
    ["lamb chop", "lammekotelet, lammekoteletter"],
    ["leg of lamb", "lammekølle"],
    ["meatball", "kødbolle, frikadelle, frikadeller"],
    ["burger patty, burger", "hakkebøf, burgerbøf"],
    ["duck, duck breast, duck leg", "andebryst, andelår, hel and"],
    ["venison, game", "hjortekød, vildt"],
    ["meat", "kød"],
    ["fillet", "filet"],
    ["fish, fish fillet", "fisk, fiskefilet"],
    ["white fish", "hvid fisk"],
    ["salmon, salmon fillet", "laks, laksefilet"],
    ["smoked salmon", "røget laks, røgelaks"],
    ["cod", "torsk, torskefilet"],
    ["haddock", "kuller"],
    ["pollock, coley, saithe", "sej"],
    ["plaice", "rødspætte"],
    ["hake", "kulmule"],
    ["tuna steak", "tunbøf"],
    ["trout", "ørred"],
    ["mackerel", "makrel"],
    ["herring", "sild"],
    ["prawn, shrimp, king prawn", "reje, rejer"],
    ["mussel", "musling, blåmusling, muslinger"],
    ["squid, octopus", "blæksprutte"],
    ["crab", "krabbe"],
    ["lobster, langoustine", "hummer, jomfruhummer"],
    ["fish cake", "fiskefrikadelle, fiskefrikadeller"],
  ],
  "Dry goods": [
    ["pasta", "pasta"],
    ["spaghetti", "spaghetti"],
    ["penne", "penne"],
    ["fusilli", "fusilli"],
    ["macaroni", "makaroni"],
    ["tagliatelle", "tagliatelle"],
    ["lasagne sheet, lasagne", "lasagneplade, lasagneplader, lasagne"],
    ["noodle, egg noodle", "nudel, nudler"],
    ["rice noodle", "risnudler"],
    ["rice", "ris"],
    ["basmati rice", "basmatiris"],
    ["jasmine rice", "jasminris"],
    ["risotto rice, arborio rice", "risottoris, grødris"],
    ["brown rice", "brune ris, fuldkornsris"],
    ["couscous", "couscous"],
    ["bulgur", "bulgur"],
    ["quinoa", "quinoa"],
    ["pearl barley", "perlebyg, byg"],
    ["oat, rolled oat, porridge oat, oatmeal", "havregryn"],
    ["muesli", "müsli, mysli"],
    ["cereal, cornflakes", "cornflakes, morgenmadsprodukt"],
    ["granola", "granola"],
    ["flour, plain flour, wheat flour, all-purpose flour, self-raising flour", "mel, hvedemel"],
    ["wholemeal flour", "fuldkornshvedemel, grahamsmel"],
    ["rye flour", "rugmel"],
    ["cornflour, cornstarch", "majsstivelse, maizena"],
    ["potato starch", "kartoffelmel"],
    ["semolina", "semuljegryn"],
    ["sugar, caster sugar, granulated sugar", "sukker"],
    ["brown sugar, muscovado sugar", "brun farin, farin, muscovadosukker"],
    ["icing sugar, powdered sugar", "flormelis"],
    ["cane sugar", "rørsukker"],
    ["vanilla sugar", "vaniljesukker"],
    ["baking powder", "bagepulver"],
    ["bicarbonate of soda, baking soda", "natron"],
    ["yeast", "gær"],
    ["vanilla, vanilla pod, vanilla extract", "vanilje, vaniljestang, vaniljeekstrakt"],
    ["cocoa, cocoa powder", "kakao, kakaopulver"],
    ["chocolate, dark chocolate, milk chocolate", "chokolade, mørk chokolade, mælkechokolade"],
    ["marzipan", "marcipan"],
    ["caramel", "karamel"],
    ["gelatine", "husblas, gelatine"],
    ["honey", "honning"],
    ["syrup, golden syrup", "sirup, lys sirup"],
    ["maple syrup", "ahornsirup"],
    ["nut, mixed nut", "nød, nødder"],
    ["almond", "mandel, mandler"],
    ["walnut", "valnød, valnødder"],
    ["hazelnut", "hasselnød, hasselnødder"],
    ["cashew, cashew nut", "cashewnød, cashewnødder"],
    ["peanut", "peanut, peanuts, jordnød, jordnødder"],
    ["pine nut", "pinjekerne, pinjekerner"],
    ["seed", "kerne, kerner, frø"],
    ["sunflower seed", "solsikkekerne, solsikkekerner"],
    ["pumpkin seed", "græskarkerne, græskarkerner"],
    ["sesame seed, sesame", "sesamfrø, sesam"],
    ["chia seed", "chiafrø"],
    ["linseed, flaxseed", "hørfrø"],
    ["raisin", "rosin"],
    ["dried apricot", "tørret abrikos, tørrede abrikoser"],
    ["date", "daddel, dadler"],
    ["prune", "sveske"],
    ["dried cranberry", "tranebær"],
    ["lentil, red lentil, green lentil", "linse, røde linser, grønne linser"],
    ["stock, stock cube, broth, bouillon", "bouillon, bouillonterning, bouillonterninger"],
    ["breadcrumb, panko", "rasp, panko"],
    ["cracker, biscuit, cookie", "kiks, småkage"],
    ["rice cake", "riskiks"],
    ["crisps, potato chips", "chips"],
    ["tortilla chips", "tortillachips, nachos"],
    ["taco shell", "tacoskal, tacoskaller"],
    ["popcorn", "popcorn"],
    ["liquorice, licorice", "lakrids"],
    ["nori, seaweed", "nori, tang"],
    ["rice paper", "rispapir"],
    ["baby food", "babymad"],
    ["baby porridge, porridge", "babygrød, grød"],
    ["baby formula, formula milk", "modermælkserstatning"],
    ["fruit pouch, fruit puree", "klemmepose, frugtmos"],
  ],
  "Tins & jars": [
    ["chopped tomato, tinned tomato, canned tomato, plum tomato", "hakkede tomater, flåede tomater, tomater på dåse, dåsetomater"],
    ["passata", "passata, tomatpassata"],
    ["tomato puree, tomato paste", "tomatpuré, tomatkoncentrat"],
    ["sun-dried tomato", "soltørrede tomater, soltørret tomat"],
    ["coconut milk", "kokosmælk"],
    ["coconut cream", "kokoscreme, kokosfløde"],
    ["chickpea", "kikært, kikærter"],
    ["kidney bean", "kidneybønne, kidneybønner"],
    ["black bean", "sorte bønner, sort bønne"],
    ["white bean, cannellini bean, butter bean", "hvide bønner, butterbeans"],
    ["baked bean", "baked beans"],
    ["bean", "bønne, bønner"],
    ["tuna, tinned tuna", "tun, tun i vand"],
    ["mackerel in tomato", "makrel i tomat"],
    ["pickled herring", "marinerede sild, kryddersild"],
    ["anchovy", "ansjos, ansjoser"],
    ["olive", "oliven"],
    ["caper", "kapers"],
    ["gherkin, pickle, cornichon", "syltede agurker, agurkesalat, asier, cornichon"],
    ["pickled beetroot", "syltede rødbeder, rødbeder i glas"],
    ["artichoke heart", "artiskokhjerte, artiskokhjerter"],
    ["roasted pepper", "grillede peberfrugter"],
    ["jam, marmalade", "syltetøj, marmelade"],
    ["peanut butter", "peanutbutter, peanutsmør, jordnøddesmør"],
    ["pesto", "pesto"],
    ["chocolate spread", "nutella, chokoladecreme"],
    ["apple sauce", "æblemos"],
    ["soup", "suppe"],
    ["liquid stock, fond", "fond, kalvefond, oksefond"],
  ],
  "Spices & sauces": [
    ["salt, sea salt, flaky salt", "salt, havsalt, flagesalt"],
    ["salt and pepper", "salt og peber"],
    ["black pepper, ground pepper, peppercorn", "peber, sort peber, peberkorn, friskkværnet peber"],
    ["white pepper", "hvid peber"],
    ["paprika, smoked paprika", "paprika, røget paprika"],
    ["cumin, ground cumin", "spidskommen"],
    ["caraway", "kommen"],
    ["ground coriander, coriander seed", "stødt koriander, korianderfrø"],
    ["turmeric", "gurkemeje"],
    ["curry powder, curry", "karry"],
    ["garam masala", "garam masala"],
    ["cinnamon", "kanel"],
    ["cardamom", "kardemomme"],
    ["nutmeg", "muskatnød, muskat"],
    ["clove", "nellike, kryddernellike"],
    ["allspice", "allehånde"],
    ["bay leaf", "laurbærblad"],
    ["oregano", "oregano"],
    ["dried thyme", "tørret timian"],
    ["dried basil", "tørret basilikum"],
    ["dried herb, mixed herb, herbes de provence", "tørrede krydderurter, provencekrydderi"],
    ["chilli flake, chili flake", "chiliflager"],
    ["chilli powder, chili powder, cayenne pepper, cayenne", "chilipulver, cayennepeber"],
    ["garlic powder", "hvidløgspulver"],
    ["onion powder", "løgpulver"],
    ["ground ginger", "ingefærpulver, stødt ingefær"],
    ["star anise", "stjerneanis"],
    ["saffron", "safran"],
    ["spice, spice mix, seasoning", "krydderi, krydderiblanding"],
    ["taco seasoning, taco spice", "tacokrydderi"],
    ["soy sauce", "sojasovs, sojasauce, soja"],
    ["fish sauce", "fiskesauce, fiskesovs"],
    ["oyster sauce", "østerssauce, østerssovs"],
    ["sweet chilli sauce", "sød chilisauce"],
    ["sriracha, hot sauce, tabasco", "sriracha, tabasco"],
    ["ketchup", "ketchup"],
    ["mustard, dijon mustard", "sennep, dijonsennep"],
    ["mayonnaise, mayo", "mayonnaise, mayo"],
    ["remoulade", "remoulade"],
    ["sauce", "sauce, sovs"],
    ["pasta sauce, tomato sauce", "pastasauce, tomatsauce"],
    ["curry paste, red curry paste, green curry paste", "karrypasta, rød karrypasta, grøn karrypasta"],
    ["worcestershire sauce", "worcestershiresauce"],
    ["bbq sauce, barbecue sauce", "barbecuesauce, bbq sauce"],
    ["tahini", "tahin, tahini"],
    ["harissa", "harissa"],
    ["miso", "miso"],
    ["dressing", "dressing"],
    ["vinegar, white wine vinegar, red wine vinegar", "eddike, hvidvinseddike, rødvinseddike"],
    ["balsamic vinegar, balsamic", "balsamico, balsamicoeddike"],
    ["apple cider vinegar", "æblecidereddike"],
    ["rice vinegar", "riseddike"],
    ["oil, cooking oil", "olie"],
    ["olive oil, extra virgin olive oil", "olivenolie"],
    ["rapeseed oil, canola oil", "rapsolie"],
    ["sunflower oil, vegetable oil, neutral oil", "solsikkeolie, vegetabilsk olie, neutral olie"],
    ["sesame oil", "sesamolie"],
    ["coconut oil", "kokosolie"],
    ["lemon juice", "citronsaft"],
    ["lime juice", "limesaft"],
  ],
  Frozen: [
    ["pea, garden pea, petit pois", "ært, ærter, grønne ærter"],
    ["frozen vegetable, mixed vegetable", "frostgrøntsager, wokgrøntsager"],
    ["ice cream", "is, flødeis"],
    ["ice lolly", "ispind"],
    ["fish finger", "fiskepind, fiskepinde"],
    ["french fries, oven chips, fries", "pommes frites, ovnfritter"],
    ["puff pastry", "butterdej"],
    ["pizza, frozen pizza", "pizza, frostpizza"],
    ["edamame", "edamamebønner, edamame"],
    ["spring roll", "forårsrulle, forårsruller"],
    ["ice cube", "isterninger"],
  ],
  Drinks: [
    ["water, sparkling water, mineral water", "vand, danskvand, mineralvand"],
    ["juice, orange juice, apple juice", "juice, appelsinjuice, æblejuice"],
    ["cordial", "saft"],
    ["soft drink, soda, cola, fizzy drink", "sodavand, cola"],
    ["beer", "øl"],
    ["wine, red wine, white wine", "vin, rødvin, hvidvin"],
    ["cider", "cider"],
    ["coffee", "kaffe"],
    ["tea", "te"],
  ],
  Other: [
    ["baking paper", "bagepapir"],
    ["tin foil, aluminium foil", "sølvpapir, alufolie"],
    ["kitchen roll", "køkkenrulle"],
    ["cling film", "husholdningsfilm"],
    ["nappy, diaper", "ble, bleer"],
    ["washing-up liquid", "opvaskemiddel"],
  ],
};

const list = (names: string) => names.split(",").map((name) => name.trim()).filter(Boolean);

export const groceries: Grocery[] = Object.entries(table).flatMap(([section, rows]) =>
  rows.map(([en, da]) => {
    const grocery: Grocery = { en: list(en), da: list(da), section: section as ShopSection };
    const pack = packOf(grocery.en[0]!);
    return pack ? { ...grocery, pack } : grocery;
  }),
);

/** Lower case, æ/ø/å written ae/oe/aa and other accents dropped, so "oksekød" and "oksekoed" are the same. */
function fold(text: string) {
  return text
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const units = new Set("g kg mg ml cl dl l stk pcs pc tsk spsk tsp tbsp tbs knsp x oz lb cup cups".split(" "));
// Words that say how much, how cut or how fresh, never what. They never match on their own.
const descriptors = new Set(
  fold(
    "fresh freshly organic large small medium big ripe whole raw cooked dried dry chopped diced sliced minced grated crushed peeled " +
      "finely roughly tinned canned jar tin can of a an the and or for to taste optional few some handful bunch pinch about " +
      "frisk friske økologisk økologiske hakket hakkede finthakket grofthakket revet revne skåret skiver i og eller af til lidt en et " +
      "stor store lille små moden modne tørret tørrede kogt kogte rå dåse dåser glas pose poser bundt håndfuld knivspids evt efter smag " +
      "hel hele ca gerne groft fint mellemstor mellemstore",
  ).split(" "),
);
const frozenWords = new Set(["frozen", "frost", "frosne", "frossen", "frosset", "dybfrost", "dybfrosne", "dybfrossen"]);

const byName = new Map<string, Grocery>();
for (const grocery of groceries) for (const name of [...grocery.en, ...grocery.da]) if (!byName.has(fold(name))) byName.set(fold(name), grocery);
const display = [...new Set(groceries.flatMap((grocery) => [...grocery.en, ...grocery.da]))].map((name) => ({ name, key: fold(name) }));

/** Bare words of a name: no amounts, units, brackets or punctuation. */
function wordsOf(name: string) {
  return fold(name.replace(/\([^)]*\)|\[[^\]]*\]/g, " "))
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !units.has(word));
}

// English plurals and Danish endings back to the listed form: "tomatoes", "tomater", "tomaterne" -> tomat(o).
function inflections(word: string) {
  const forms = [word];
  const add = (stem: string) => {
    if (stem.length < 2) return;
    forms.push(stem);
    if (/([bcdfghjklmnpqrstvwxz])\1$/.test(stem)) forms.push(stem.slice(0, -1));
  };
  if (word.endsWith("ies")) add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ves")) add(`${word.slice(0, -3)}f`);
  if (word.endsWith("es")) add(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss")) add(word.slice(0, -1));
  for (const ending of ["erne", "ene", "rne", "ne", "er", "en", "et", "r", "n"]) if (word.endsWith(ending)) add(word.slice(0, -ending.length));
  return forms;
}

// Inside a compound, two-letter names ("te", "is") would match far too much.
const known = (word: string, shortest = 0) =>
  inflections(word)
    .filter((form) => form.length >= shortest)
    .map((form) => byName.get(form))
    .find(Boolean);

// A Danish compound is a thing of its last part ("piskefløde" is cream), or else of its first ("hvidløgsfed" is garlic, with the linking s).
function compound(word: string) {
  for (let at = 1; at <= word.length - 3; at++) {
    const found = known(word.slice(at), 3);
    if (found) return found;
  }
  // The rest must be a real part ("fed"), or "tomatoe" would read as tomato + e and never be offered a fix.
  for (let end = word.length - 3; end >= 3; end--) {
    const head = word.slice(0, end);
    const found = byName.get(head) ?? (/[se]$/.test(head) ? byName.get(head.slice(0, -1)) : undefined);
    if (found) return found;
  }
  return undefined;
}

/** Longest run of words that names a grocery, rightmost first, since the thing comes last in both languages. */
function exact(words: string[]) {
  for (let size = words.length; size >= 1; size--) {
    for (let start = words.length - size; start >= 0; start--) {
      const run = words.slice(start, start + size);
      if (size === 1 && descriptors.has(run[0]!)) continue;
      const head = run.slice(0, -1).join(" ");
      const found = inflections(run.at(-1)!)
        .map((form) => byName.get(head ? `${head} ${form}` : form))
        .find(Boolean);
      if (found) return found;
      if (size === 1 && !frozenWords.has(run[0]!)) {
        const part = compound(run[0]!);
        if (part) return part;
      }
    }
  }
  return undefined;
}

const allowedDistance = (length: number) => (length >= 8 ? 2 : length >= 5 ? 1 : 0);

// Optimal string alignment distance: insertions, deletions, swaps and two letters the wrong way round each count 1.
function distance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}

/** Known names close to a typed one, best first, one per grocery. A name it starts ("tomat" for "tomatp") counts as close too. */
function closest(query: string, slack = 0) {
  if (query.length < 3) return [];
  const best = new Map<Grocery, { name: string; score: number }>();
  for (const { name, key } of display) {
    const away = distance(query, key);
    const score = away <= allowedDistance(query.length) + (query.length >= 5 ? slack : 0) ? away : query.length >= 4 && key.startsWith(query) ? 1 + (key.length - query.length) / 100 : undefined;
    if (score === undefined || score === 0) continue;
    const grocery = byName.get(key)!;
    const before = best.get(grocery);
    if (!before || score < before.score || (score === before.score && name.length < before.name.length)) best.set(grocery, { name, score });
  }
  return [...best.entries()].sort(([, a], [, b]) => a.score - b.score || a.name.length - b.name.length).map(([grocery, { name }]) => ({ grocery, name }));
}

const meaningful = (name: string) => wordsOf(name).filter((word) => !descriptors.has(word) && !frozenWords.has(word));

/** The grocery a name means, allowing a spelling slip ("brocoli") or a stray Danish -e ("agurke"). */
function loose(name: string) {
  const words = meaningful(name);
  for (const word of [...words].reverse()) {
    if (word.endsWith("e") && word.length > 3) {
      const found = byName.get(word.slice(0, -1));
      if (found) return found;
    }
  }
  const phrase = words.join(" ");
  if (allowedDistance(phrase.length) === 0) return undefined;
  return closest(phrase).find(({ name }) => distance(phrase, fold(name)) <= allowedDistance(phrase.length))?.grocery;
}

/** The grocery a typed ingredient name means, if any. `exact` is false for a near miss that "Did you mean" should offer to fix. */
export function recognise(name: string): { grocery: Grocery; exact: boolean } | undefined {
  const words = wordsOf(name);
  const found = exact(words);
  if (found) return { grocery: found, exact: true };
  const near = loose(name);
  return near ? { grocery: near, exact: false } : undefined;
}

/**
 * The shop section a new ingredient most likely lives in. Knows English and Danish, plurals, Danish endings and compounds,
 * and words like "fresh" or "hakket" in front. Saying frozen ("frozen spinach", "frosne bær") always means Frozen.
 */
export function guessShopSection(name: string): ShopSection {
  if (wordsOf(name).some((word) => frozenWords.has(word))) return "Frozen";
  return recognise(name)?.grocery.section ?? "Other";
}

/** Up to 3 known names close to one that isn't recognised: "tomatoe" -> tomato, "agurke" -> agurk. Nothing for a known name. */
export function didYouMean(name: string): string[] {
  if (recognise(name)?.exact) return [];
  // One more slip than a guess allows, so "rodlog" still finds rødløg.
  return closest(meaningful(name).join(" "), 1)
    .slice(0, 3)
    .map(({ name: known }) => known);
}

/** The main Danish name for a known English or Danish name ("chicken breasts" -> kyllingebryst), for a Danish shop search. */
export function danishName(name: string): string | undefined {
  return recognise(name)?.grocery.da[0];
}

/**
 * The grocery a whole name is, with nothing guessed: "løg", "onions" and "Chopped tomatoes" yes; "garlic powder" (garlic + powder),
 * "hvidløgspulver" (a compound) or a spelling slip no. Pack sizes and merging two names into one shopping line use this, since
 * a wrong guess there buys the wrong thing.
 */
export function groceryOf(name: string): Grocery | undefined {
  const words = wordsOf(name);
  const frozen = words.some((word) => frozenWords.has(word));
  for (const phrase of [words, words.filter((word) => !descriptors.has(word) && !frozenWords.has(word))]) {
    if (!phrase.length) continue;
    const head = phrase.slice(0, -1).join(" ");
    const found = inflections(phrase.at(-1)!)
      .map((form) => byName.get(head ? `${head} ${form}` : form))
      .find(Boolean);
    // "Frozen peas" is not a bag of fresh peas.
    if (found) return frozen && found.section !== "Frozen" ? undefined : found;
  }
  return undefined;
}
