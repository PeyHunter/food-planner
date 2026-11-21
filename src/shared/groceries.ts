import { moreGroceries, moreNames } from "./groceries-more.ts";
import { packFrom, packOf, type Pack } from "./grocery-packs.ts";
import type { Language } from "./profile.ts";
import type { ShopSection } from "./recipes.ts";

/**
 * One thing you can buy. English names are singular; the first Danish name, usually the plural, is the one a Danish shop search uses.
 * `pack` is how Danish shops sell it, when known (see docs/research/danish-pack-sizes.md).
 */
export type Grocery = { en: string[]; da: string[]; section: ShopSection; pack?: Pack };

// [English names, Danish names], comma separated. Irregular Danish plurals are listed as names of their own.
const table: Record<ShopSection, [string, string][]> = {
  Vegetables: [
    ["potato", "kartofler, kartoffel"],
    ["new potato, baby potato", "nye kartofler, nye kartoffel"],
    ["sweet potato", "sødkartofler, sødkartoffel, søde kartofler"],
    ["onion, yellow onion, brown onion", "løg, gule løg"],
    ["red onion", "rødløg, røde løg"],
    ["spring onion, scallion, green onion", "forårsløg"],
    ["shallot", "skalotteløg"],
    ["leek", "porrer, porre, porreløg"],
    ["garlic, garlic clove, clove of garlic, garlic bulb", "hvidløg, hvidløgsfed"],
    ["carrot", "gulerødder, gulerod"],
    ["tomato, vine tomato, beef tomato", "tomater, tomat"],
    ["cherry tomato", "cherrytomater, cherrytomat, cocktailtomat"],
    ["cucumber", "agurk"],
    ["pepper, bell pepper, red pepper, green pepper, yellow pepper", "peberfrugt, rød peberfrugt"],
    ["chilli, chili, chile, chilli pepper, red chilli, green chilli, jalapeno", "chili, chilipeber, rød chili, chilifrugt"],
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
    ["beetroot, beet", "rødbeder, rødbede"],
    ["turnip, swede", "majroe, kålroe"],
    ["jerusalem artichoke", "jordskok"],
    ["radish", "radiser, radise"],
    ["fennel", "fennikel"],
    ["pumpkin", "græskar, hokkaido"],
    ["butternut squash, butternut", "butternutsquash, butternut"],
    ["mushroom, button mushroom, chestnut mushroom", "champignoner, champignon, svamp, svampe"],
    ["oyster mushroom", "østershatte, østershat"],
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
    ["lemon", "citroner, citron"],
    ["lime", "limefrugter, lime"],
    ["apple", "æbler, æble"],
    ["pear", "pærer, pære"],
    ["banana", "bananer, banan"],
    ["orange", "appelsiner, appelsin"],
    ["clementine, mandarin, satsuma", "klementiner, klementin, mandarin"],
    ["grape", "vindruer, vindrue, drue"],
    ["strawberry", "jordbær"],
    ["blueberry", "blåbær"],
    ["raspberry", "hindbær"],
    ["blackberry", "brombær"],
    ["berry, mixed berry", "bær"],
    ["cherry", "kirsebær"],
    ["plum", "blommer, blomme"],
    ["peach", "ferskner, fersken"],
    ["nectarine", "nektariner, nektarin"],
    ["apricot", "abrikoser, abrikos"],
    ["mango", "mango"],
    ["pineapple", "ananas"],
    ["melon, watermelon, honeydew melon", "melon, vandmelon"],
    ["kiwi", "kiwi"],
    ["pomegranate", "granatæble"],
    ["fig", "figner, figen"],
    ["passion fruit", "passionsfrugt"],
    ["rhubarb", "rabarber"],
    ["grapefruit", "grapefrugt"],
    ["fruit", "frugt"],
    ["vegetable", "grøntsager, grøntsag"],
  ],
  Bread: [
    ["bread, loaf", "brød"],
    ["rye bread", "rugbrød"],
    ["white bread, sandwich bread, toast", "franskbrød, toastbrød"],
    ["wholemeal bread", "fuldkornsbrød"],
    ["sourdough bread, sourdough", "surdejsbrød"],
    ["bread roll, roll, bun", "boller, bolle, rundstykke, rundstykker"],
    ["baguette", "flute, baguette"],
    ["pitta bread, pita bread, pitta, pita", "pitabrød, pita"],
    ["naan bread, naan", "naanbrød, naan"],
    ["tortilla, wrap, flour tortilla", "tortilla, wrap"],
    ["burger bun", "burgerboller, burgerbolle"],
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
    ["pecorino, pecorino romano", "pecorino"],
    ["grana padano", "grana padano"],
    ["gruyere, gruyère, comte, comté", "gruyère, comté"],
    ["emmental, emmentaler", "emmentaler"],
    ["manchego", "manchego"],
    ["gorgonzola, roquefort, stilton", "gorgonzola, roquefort"],
    ["camembert", "camembert"],
    ["burrata, stracciatella", "burrata, stracciatella"],
    ["provolone", "provolone"],
    ["taleggio", "taleggio"],
    ["havarti, danbo, gouda, edam", "havarti, danbo, gouda, edamer"],
    ["paneer", "paneer"],
    ["vegan cheese", "vegansk ost, plantebaseret ost"],
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
    ["chicken wing", "kyllingevinger, kyllingevinge"],
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
    ["pork chop", "koteletter, svinekotelet, kotelet"],
    ["pork tenderloin, pork fillet", "svinemørbrad"],
    ["pork belly", "flæsk, stegeflæsk, svinebryst"],
    ["roast pork", "flæskesteg"],
    ["pork neck", "nakkefilet, svinenakke"],
    ["bacon, bacon lardons, lardons", "bacon, baconskiver, bacontern"],
    ["ham", "skinke, hamburgerryg"],
    ["sausage", "pølser, pølse"],
    ["chorizo", "chorizo"],
    ["salami, pepperoni", "salami, spegepølse, pepperoni"],
    ["liver pâté", "leverpostej"],
    ["cold cuts, sliced meat", "pålæg"],
    ["lamb", "lam, lammekød"],
    ["minced lamb, lamb mince", "hakket lam, lammefars"],
    ["lamb chop", "lammekoteletter, lammekotelet"],
    ["leg of lamb", "lammekølle"],
    ["meatball", "frikadeller, kødbolle, kødboller, frikadelle"],
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
    ["prawn, shrimp, king prawn", "rejer, reje"],
    ["mussel", "muslinger, musling, blåmuslinger, blåmusling"],
    ["squid, octopus", "blæksprutte"],
    ["crab", "krabbe"],
    ["lobster, langoustine", "hummer, jomfruhummer"],
    ["fish cake", "fiskefrikadeller, fiskefrikadelle"],
  ],
  "Dry goods": [
    ["pasta", "pasta"],
    ["spaghetti", "spaghetti"],
    ["penne", "penne"],
    ["fusilli", "fusilli"],
    ["macaroni", "makaroni"],
    ["tagliatelle", "tagliatelle"],
    ["lasagne sheet, lasagne", "lasagneplader, lasagneplade, lasagne"],
    ["noodle, egg noodle", "nudler, nudel"],
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
    ["nut, mixed nut", "nødder, nød"],
    ["almond", "mandler, mandel"],
    ["walnut", "valnødder, valnød"],
    ["hazelnut", "hasselnødder, hasselnød"],
    ["cashew, cashew nut", "cashewnødder, cashewnød"],
    ["peanut", "peanut, peanuts, jordnød, jordnødder"],
    ["pine nut", "pinjekerner, pinjekerne"],
    ["seed", "kerner, kerne, frø"],
    ["sunflower seed", "solsikkekerner, solsikkekerne"],
    ["pumpkin seed", "græskarkerner, græskarkerne"],
    ["sesame seed, sesame", "sesamfrø, sesam"],
    ["chia seed", "chiafrø"],
    ["linseed, flaxseed", "hørfrø"],
    ["raisin", "rosiner, rosin"],
    ["dried apricot", "tørrede abrikoser, tørret abrikos"],
    ["date", "dadler, daddel"],
    ["prune", "svesker, sveske"],
    ["dried cranberry", "tranebær"],
    ["lentil, red lentil, green lentil", "linser, linse, røde linser, grønne linser"],
    ["stock, stock cube, broth, bouillon", "bouillon, bouillonterning, bouillonterninger"],
    ["breadcrumb, panko", "rasp, panko"],
    ["cracker, biscuit, cookie", "kiks, småkage"],
    ["rice cake", "riskiks"],
    ["crisps, potato chips", "chips"],
    ["tortilla chips", "tortillachips, nachos"],
    ["taco shell", "tacoskaller, tacoskal"],
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
    ["chickpea", "kikærter, kikært"],
    ["kidney bean", "kidneybønner, kidneybønne"],
    ["black bean", "sorte bønner, sort bønne"],
    ["white bean, cannellini bean, butter bean", "hvide bønner, butterbeans"],
    ["baked bean", "baked beans"],
    ["bean", "bønner, bønne"],
    ["tuna, tinned tuna", "tun, tun i vand"],
    ["mackerel in tomato", "makrel i tomat"],
    ["pickled herring", "marinerede sild, kryddersild"],
    ["anchovy", "ansjoser, ansjos"],
    ["sardine", "sardiner, sardin"],
    ["olive", "oliven"],
    ["caper", "kapers"],
    ["gherkin, pickle, cornichon", "syltede agurker, agurkesalat, asier, cornichon"],
    ["pickled beetroot", "syltede rødbeder, rødbeder i glas"],
    ["artichoke heart", "artiskokhjerter, artiskokhjerte"],
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
    ["sichuan pepper, szechuan pepper, szechwan pepper, sichuan peppercorn, szechuan peppercorn", "szechuanpeber, sichuanpeber"],
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
    ["dried herb, mixed herb, herbes de provence", "tørrede krydderurter, provencekrydderi"],
    ["chilli flake, chili flake, red pepper flake, pepper flake, crushed red pepper", "chiliflager, chiliflakes"],
    ["chilli powder, chili powder, chile powder, cayenne pepper, cayenne", "chilipulver, cayennepeber"],
    ["garlic powder", "hvidløgspulver"],
    ["onion powder", "løgpulver"],
    ["ground ginger", "ingefærpulver, stødt ingefær"],
    ["star anise", "stjerneanis"],
    ["saffron", "safran"],
    ["fenugreek, fenugreek seed", "bukkehornsfrø, bukkehorn"],
    ["fennel seed", "fennikelfrø"],
    ["mustard seed", "sennepsfrø"],
    ["nigella seed, black onion seed", "sortkommen, nigellafrø"],
    ["juniper berry", "enebær"],
    ["sumac", "sumak"],
    ["zaatar, za'atar", "zaatar"],
    ["ras el hanout", "ras el hanout"],
    ["five spice, chinese five spice", "five spice"],
    ["mace", "muskatblomme"],
    ["anise, aniseed", "anis"],
    ["chipotle", "chipotle"],
    ["celery salt", "sellerisalt"],
    ["smoked salt", "røget salt"],
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
    ["pea, garden pea, petit pois", "ærter, ært, grønne ærter"],
    ["frozen vegetable, mixed vegetable", "frostgrøntsager, wokgrøntsager"],
    ["frozen spinach", "frossen spinat, frosne spinat, bladspinat frost"],
    ["frozen berry, frozen raspberry, frozen blueberry, frozen strawberry", "frosne bær, frosne hindbær, frosne blåbær, frosne jordbær, bærmix"],
    ["ice cream", "is, flødeis"],
    ["ice lolly", "ispind"],
    ["fish finger", "fiskepinde, fiskepind"],
    ["french fries, oven chips, fries", "pommes frites, ovnfritter"],
    ["puff pastry", "butterdej"],
    ["pizza, frozen pizza", "pizza, frostpizza"],
    ["edamame", "edamamebønner, edamame"],
    ["spring roll", "forårsruller, forårsrulle"],
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

export const groceries: Grocery[] = [
  ...Object.entries(table).flatMap(([section, rows]) =>
    rows.map(([en, da]) => {
      const first = list(en)[0]!;
      const [moreEn, moreDa] = moreNames[first] ?? ["", ""];
      const grocery: Grocery = { en: [...list(en), ...list(moreEn)], da: [...list(da), ...list(moreDa)], section: section as ShopSection };
      const pack = packOf(first);
      return pack ? { ...grocery, pack } : grocery;
    }),
  ),
  ...Object.entries(moreGroceries).flatMap(([section, rows]) =>
    rows.map(([en, da, row]): Grocery => ({ en: list(en), da: list(da), section: section as ShopSection, ...(row ? { pack: packFrom(row) } : {}) })),
  ),
];

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
// Said anywhere in the name, these put it with the tins: "hakkede tomat dåse" is not a fresh tomato.
const tinWords = new Set(fold("dåse dåser dåsen can cans canned tin tins tinned").split(" "));
const driedWords = new Set(fold("dried dry tørret tørrede").split(" "));
// Fresh herbs, chillies and mushrooms sit with the vegetables, but dried ones are in the spice rack or with the dry goods.
const driedSection: Record<string, ShopSection> = {
  ...Object.fromEntries(
    ["parsley", "coriander", "basil", "dill", "chive", "mint", "thyme", "rosemary", "sage", "tarragon", "herb", "chilli"].map((herb) => [herb, "Spices & sauces"]),
  ),
  mushroom: "Dry goods",
};
// What comes after these is what the thing is in or for, not the thing: "sardines packed in olive oil", "æg til mayo".
const asides = new Set(["in", "with", "packed", "til"]);

const byName = new Map<string, Grocery>();
// Keyed the way a typed name is read, without punctuation or digits: "sun-dried tomato" is found as "sun dried tomato".
const nameKey = (name: string) => fold(name).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).join(" ");
for (const grocery of groceries) for (const name of [...grocery.en, ...grocery.da]) if (!byName.has(nameKey(name))) byName.set(nameKey(name), grocery);
const danishNames = new Set(groceries.flatMap((grocery) => grocery.da));
const englishNames = new Set(groceries.flatMap((grocery) => grocery.en));
const display = [...new Set(groceries.flatMap((grocery) => [...grocery.en, ...grocery.da]))].map((name) => ({
  name,
  key: nameKey(name),
  da: danishNames.has(name),
  en: englishNames.has(name),
}));

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
function exact(words: string[], compounds = true) {
  for (let size = words.length; size >= 1; size--) {
    for (let start = words.length - size; start >= 0; start--) {
      const run = words.slice(start, start + size);
      if (size === 1 && descriptors.has(run[0]!)) continue;
      const head = run.slice(0, -1).join(" ");
      const found = inflections(run.at(-1)!)
        .map((form) => byName.get(head ? `${head} ${form}` : form))
        .find(Boolean);
      if (found) return found;
      // A compound written apart: "tomat puré" is tomatpuré.
      const joined = size === 2 ? byName.get(run.join("")) : undefined;
      if (joined) return joined;
      if (compounds && size === 1 && !frozenWords.has(run[0]!)) {
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

/**
 * Known names close to a typed one, best first, one per grocery. A name it starts ("tomat" for "tomatp") counts as close too.
 * `slack` allows more slips; on a short word it allows one missing or extra letter ("dil" -> dild). `only` keeps one language's names.
 */
function closest(query: string, slack = 0, only?: Language) {
  if (query.length < 3) return [];
  const best = new Map<Grocery, { name: string; score: number }>();
  for (const { name, key, da, en } of display) {
    if ((only === "da" && !da) || (only === "en" && !en)) continue;
    const away = distance(query, key);
    const limit = allowedDistance(query.length) + (query.length >= 5 ? slack : slack && Math.abs(key.length - query.length) === 1 ? 1 : 0);
    const score = away <= limit ? away : query.length >= 4 && key.startsWith(query) ? 1 + (key.length - query.length) / 100 : undefined;
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
  const aside = words.findIndex((word, at) => at > 0 && asides.has(word));
  const found = (aside > 0 ? exact(words.slice(0, aside)) : undefined) ?? exact(words);
  if (found) return { grocery: found, exact: true };
  const near = loose(name);
  return near ? { grocery: near, exact: false } : undefined;
}

/**
 * The shop section a new ingredient most likely lives in. Knows English and Danish, plurals, Danish endings and compounds,
 * and words like "fresh" or "hakket" in front. Saying frozen ("frozen spinach", "frosne bær") always means Frozen,
 * a tin word ("dåse", "canned") always means Tins & jars, and a dried herb or chilli ("dried basil", "tørret timian") is a spice, dried mushrooms dry goods.
 */
export function guessShopSection(name: string): ShopSection {
  const words = wordsOf(name);
  if (words.some((word) => frozenWords.has(word))) return "Frozen";
  if (words.some((word) => tinWords.has(word))) return "Tins & jars";
  const grocery = recognise(name)?.grocery;
  const dried = grocery && words.some((word) => driedWords.has(word)) ? driedSection[grocery.en[0]!] : undefined;
  return dried ?? grocery?.section ?? "Other";
}

/**
 * Up to 3 known names close to one that isn't recognised: "tomatoe" -> tomato, "agurke" -> agurk. Nothing for a known name.
 * In Danish only Danish names are offered; in English, a word closest to a Danish name ("seleri") gets Danish names only.
 */
export function didYouMean(name: string, language: Language = "en"): string[] {
  const phrase = meaningful(name).join(" ");
  const found = recognise(name);
  if (found?.exact) {
    // Known only as the start of a compound ("laksefilt" reads as laks + "efilt"): offer a listed name one slip away.
    if (exact(wordsOf(name), false)) return [];
    return closest(phrase, 0, language === "da" ? "da" : undefined)
      .filter(({ name: known }) => distance(phrase, fold(known)) <= allowedDistance(phrase.length))
      .slice(0, 3)
      .map(({ name: known }) => known);
  }
  // One more slip than a guess allows, so "rodlog" still finds rødløg.
  let near = closest(phrase, 1, language === "da" ? "da" : undefined);
  const first = display.find((entry) => entry.name === near[0]?.name);
  if (first && first.da !== first.en) near = closest(phrase, 1, first.da ? "da" : "en");
  return near.slice(0, 3).map(({ name: known }) => known);
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
