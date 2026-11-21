# Round Danish shopping lists to real packs

Danish home cooking is built on a small core of about 40 ingredients that turn up in more than 6% of recipes: butter, wheat flour, salt and pepper, garlic, eggs, sugar, olive oil, onions, stock, fresh coriander, whipping cream, milk, carrots, lemon, yeast, ginger, crème fraîche, canned chopped tomatoes, tomato paste and a rack of dried spices. Around that core sits a long tail of roughly 400 items covering Danish classics, Italian, Asian, Mexican and Middle Eastern dishes, baking, breakfast and baby food. For these, the research collected the real pack sizes at **nemlig.com** (about 150 product pages opened) and **REMA 1000** (its web shop prints the pack size on every product). The headline result for the app is that **nemlig's packs are often bigger than REMA's and come in several sizes under one name**: potatoes and carrots 2 kg instead of 1 kg, champignon 500 g instead of 250 g, minced beef 500 g instead of 400 g, cooking cream 0.5 l instead of 250 ml. On the other hand, nemlig's crème fraîche is 250 g where REMA's own brand is 500 g. So the app must store a nemlig **product ID** for each item, not just a search term. Netto, Lidl Danmark and Meny could not be checked at all, because their sites render only in a browser and offer no readable catalogue. About a quarter of the rows below (mostly dry goods, a few sauces, baby jars and summer produce) are typical sizes from general market knowledge, not from a fetched page, and are marked **low**. Three traps would make shopping lists wrong if ignored: REMA prints the **drained** weight on bean and chickpea tins (240–252 g for a 400 g tin), nemlig prints some cultured dairy in **litres** where REMA prints kilograms, and Arla's standard whipping cream is now **36%**, not 38%.

## About 40 ingredients cover most Danish dinners

A parse of the structured ingredient lists on **507 recipe pages** (391 from valdemarsro.dk, 107 from arla.dk, 9 from dk-kogebogen.dk; about 7,500 ingredient lines) found that the most common items, by number of recipes in the 482-recipe main batch, were **smør 214, hvedemel 188, salt og peber 188, hvidløg 170, æg 166, sukker 162, olivenolie 161, løg 122, grøntsagsbouillon 100, frisk koriander 79, piskefløde 75, mælk 71, gulerødder 68, citron 66, gær 66 and ingefær 64**. Below these came crème fraîche 18% (56), dried thyme (55), cumin (52), cinnamon (50), chili flakes (50), baking powder (48), canned chopped tomatoes (48) and cardamom (45) ([valdemarsro.dk](https://www.valdemarsro.dk/aftensmad/), [arla.dk](https://www.arla.dk/opskrifter/)). The sample leans towards baking: about 140 of the 391 Valdemarsro URLs are cakes, buns or bread. That inflates yeast, icing sugar, cardamom and marzipan compared with a normal family basket.

The weekly Danish dinner classics use a narrower core than the raw counts suggest. Frikadeller, boller i karry, karbonader, millionbøf and brunkål all draw on minced pork or beef, onion, egg, milk, flour, oats or breadcrumbs, butter, cream, potatoes, stock, curry and kulør. Arla's frikadeller, for example, use **600 g hakket grise- og kalvekød, 2 løg (ca. 150 g), 2 æg, 2 dl mælk and 40 g havregryn (ca. 1 dl)** ([Arla frikadeller](https://www.arla.dk/opskrifter/frikadeller/)). Valdemarsro's boller i karry for four use **400 g hakket svinekød, 2 tsk karry, 3 dl mælk, 3 dl bouillon and 4 dl basmati ris** ([Valdemarsro boller i karry](https://www.valdemarsro.dk/boller-i-karry/)). The median amounts for four people line up with Danish packs: **400 g minced beef, 400 g chopped tomatoes, 400 ml coconut milk, 400 g pasta, 1 kg potatoes, 250 g champignon, 8 tortillas** ([valdemarsro.dk](https://www.valdemarsro.dk/), [arla.dk](https://www.arla.dk/opskrifter/)). The mismatches are mostly small amounts: 2 cloves of garlic against a 200 g net, 1 dl cream against a 0.25 l carton, a handful of coriander against a whole pot. These are the items where leftover tracking pays off.

Recipes give their units in a consistent way. Meat, cheese, butter and flour are given in **g**. Liquids, crème fraîche and rice are given in **dl**. Spices are given in **tsk/spsk**. Garlic is always in **fed**. Onions, eggs, lemons and peppers are counted in **stk**, and herbs come in **håndfuld/bundt**. "Salt og friskkværnet peber" appears about 250 times with no amount at all ([Valdemarsro lasagne](https://www.valdemarsro.dk/lasagne/)). This means the app needs a gram weight for each counted item, and a way to treat no-amount staples as "always at home".

## Three labelling traps distort pack rounding

The first trap is **drained versus net weight on tins**. REMA's web shop lists "KIKÆRTER 240 GR." and "KIDNEYBØNNER 252 GR." ([REMA konserves](https://shop.rema1000.dk/kolonial/konserves-survarer)), yet the same chickpea tin is **400 g net / 240 g drained** ([Tænk](https://taenk.dk/test/kikaerter/rema-1000-oekologiske-kikaerter-i-lagekikaerter)), and the kidney beans are **400 g net / 252 g drained** ([Open Food Facts](https://dk.openfoodfacts.org/product/5705830010780/%C3%B8kologiske-kidneyb%C3%B8nner-rema-1000)). nemlig prints both weights, e.g. Økomama kikærter "400 g / 240 g" ([nemlig køb flere spar mere](https://www.nemlig.com/fordele/koeb-flere-spar-mere)), and Bornholms muslinger "190 g / 115 g" ([nemlig 5044486](https://www.nemlig.com/produkt/5044486)). Recipes say "1 dåse" or "400 g", so the app should store **net weight** for each tin and keep drained weight as a separate field. REMA's 285 g sweetcorn, 140 g pineapple, 140 g tuna, 60 g capers and 140 g olives are probably drained weights as well, but this was not confirmed.

The second trap is **one name, several sizes**. nemlig lists 11 "Kyllingebrystfilet" SKUs from **280 g to 1.2 kg** ([nemlig kylling](https://www.nemlig.com/kategori/koed/kylling)). It sells "Bagekartofler" as both **2 kg (5006405)** and **1.5 kg (5059035)**, and "Kanel (stødt)" as a **40 g glass jar and a 210 g tub** ([5046112](https://www.nemlig.com/produkt/5046112), [5602886](https://www.nemlig.com/produkt/5602886)). It also has four "Piskefløde 36%" SKUs ([nemlig mejeri](https://www.nemlig.com/dagligvarer/mejeri)). A search term alone will therefore pick an unknown size. The master table gives the nemlig product ID wherever one was opened, and the app should save the ID it actually orders.

The third trap is **units and fat percentages**. Danish shops print spoonable cultured dairy in grams (crème fraîche 250 g, skyr 1000 g) and liquids in litres. However, nemlig prints A38 as **"1 l"** while REMA prints it as **"1 KG."** ([nemlig 5005926](https://www.nemlig.com/produkt/5005926), [REMA syrnede](https://shop.rema1000.dk/varer/mejeri/syrnede-produkter)). The app can treat these as equal at about 1 g per ml. Arla has also cut Karolines Køkken piskefløde from 38% to **36%**; 38% now survives mainly in organic lines ([REMA fløde](https://shop.rema1000.dk/varer/mejeri/flode-mv), [nemlig 5005345](https://www.nemlig.com/produkt/5005345)). Recipes that say "piskefløde 38%" should match either.

## Piece weights let the app turn "2 løg" into packs

Few Danish product pages print piece counts, so counted items rely on the Nordic reference table *Mål, vekt og porsjonsstørrelser for matvarer* (Mattilsynet 2015, gross weight as bought). The Danish DTU equivalent returned 403. The Norwegian table gives **onion 170 g, medium carrot 90 g, medium potato 65 g, tomato 95 g, bell pepper 170 g, lemon 150 g, lime 80 g, garlic bulb 55 g, cucumber 335 g, leek 250 g, courgette 300 g, avocado 175–300 g and broccoli 460 g** ([Mattilsynet table](https://mattilsynet-xp7prod.enonic.cloud/_/attachment/inline/538de5fa-6f5d-4895-88ab-525d3da9b6cb:2f2f256b6fde0e117a9a6d2139916937eed1504b/mal-vekt-og-porsjonsstorrelser-for-matvarer.ods)). REMA's loose-sale lines give real Danish averages that are slightly heavier: **tomato 120 g, loose potato 70 g, organic carrot 80 g, parsnip 130 g, beetroot 100 g** ([REMA tomat](https://shop.rema1000.dk/varer/frugt-gront/agurk-tomat-peberfrugt), [REMA kartofler](https://shop.rema1000.dk/varer/frugt-gront/kartofler-log), [REMA grov grønt](https://shop.rema1000.dk/varer/frugt-gront/grov-gront)). Where both exist, the table uses the Danish figure.

For eggs, use **about 60 g in shell**. Danish 10-packs are mixed grade M/L, and an organic M/L 10-pack weighs 0.62 kg net ([Oregano Huset](https://oregano-huset.dk/produktkatalog/192-aeg-oekologisk/738-aeg-str-ml-dk-10-stk-oekologisk/)). For bread, nemlig prints counts where REMA does not: **pølsebrød 14 stk / 430 g, naan 2 stk / 260 g, baguettes 2 stk / 300 g** ([5071403](https://www.nemlig.com/produkt/5071403), [5066058](https://www.nemlig.com/produkt/5066058), [922583](https://www.nemlig.com/produkt/922583)). For meat, the cited counts are **entrecote 2 stk / 300 g, nakkekoteletter 4–5 stk / 500 g, frozen lakseportioner 4 stk / 400 g and frozen torskefilet 2 stk / 200 g** ([5605143](https://www.nemlig.com/produkt/5605143), [5069205](https://www.nemlig.com/produkt/5069205), [5066476](https://www.nemlig.com/produkt/5066476), [5068110](https://www.nemlig.com/produkt/5068110)). Chicken breast is about **170 g each** on the one pack that states a count (Kalu 340 g = 2 stk, [5030649](https://www.nemlig.com/produkt/5030649)). A planning value of about 150 g is reasonable.

The weakest piece weight is **garlic**. Mattilsynet lists 2.5 g per clove with skin, which implies about 18 cloves per bulb. That is too many for Danish net garlic, which usually has 10–12 cloves. A planning value of 4–5 g per clove is plausible, but no source confirms it. Herb pots, hokkaido, butternut and romaine hearts have no sourced weight at all.

## Master table by section

**How to read the table.** "Pack" is the size to round to. Where stores differ it is **nemlig's size**, and the other store's size is shown in "Seen at". "Piece g" is the average gross weight of one counted unit. Where a value comes from Mattilsynet it is marked MT; "–" means the item is not counted. "nemlig search · ID" gives the search term, and the product ID links to `nemlig.com/produkt/<id>` where that page was opened. "(n.o.)" means the ID was seen in a listing but the page was not opened, so its size is unknown. Confidence ratings: **high** means the size was read on a store page. **med** means a close variant was confirmed, or the size is a standard Danish format partly confirmed. **low** means the size is a typical size from general knowledge, with no fetched page, and must be verified before the app relies on it.

Source keys for REMA category pages: [R-KL](https://shop.rema1000.dk/varer/frugt-gront/kartofler-log), [R-GG](https://shop.rema1000.dk/varer/frugt-gront/grov-gront), [R-SF](https://shop.rema1000.dk/varer/frugt-gront/salater-fint-gront-avocado), [R-KR](https://shop.rema1000.dk/varer/frugt-gront/krydderurter-smagsforstaerkere), [R-AT](https://shop.rema1000.dk/varer/frugt-gront/agurk-tomat-peberfrugt), [R-K](https://shop.rema1000.dk/varer/frugt-gront/kal), [R-MB](https://shop.rema1000.dk/varer/frugt-gront/melon-baer-vindruer-eksotisk-frugt), [R-PA](https://shop.rema1000.dk/varer/frugt-gront/paere-aeble-banan-citrusfrugt), [R-BK](https://shop.rema1000.dk/varer/frugt-gront/blommer-fersken-nektariner-kiwi), [R-MEJ](https://shop.rema1000.dk/varer/mejeri), [R-FLO](https://shop.rema1000.dk/varer/mejeri/flode-mv), [R-SYR](https://shop.rema1000.dk/varer/mejeri/syrnede-produkter), [R-YOG](https://shop.rema1000.dk/varer/mejeri/yoghurt-mv), [R-SMO](https://shop.rema1000.dk/varer/mejeri/smor-fedtstoffer), [R-AEG](https://shop.rema1000.dk/varer/mejeri/aeg), [R-OST](https://shop.rema1000.dk/varer/ost-mv), [R-MAR](https://shop.rema1000.dk/varer/kolonial/margarine), [R-DEJ](https://shop.rema1000.dk/varer/kol/dej), [R-TEX](https://shop.rema1000.dk/varer/kolonial/tex-mex), [R-BRD](https://shop.rema1000.dk/varer/brod-bavinchi/brod), [R-RUG](https://shop.rema1000.dk/varer/brod-bavinchi/rugbrod), [R-BOL](https://shop.rema1000.dk/varer/brod-bavinchi/boller), [R-FF](https://shop.rema1000.dk/varer/brod-bavinchi/fast-food-brod), [R-BAG](https://shop.rema1000.dk/varer/brod-bavinchi/baguetteflutes), [R-hak](https://shop.rema1000.dk/varer/kod-fisk-fjerkrae/hakket-kod), [R-kyl](https://shop.rema1000.dk/varer/kod-fisk-fjerkrae/kylling), [R-gris](https://shop.rema1000.dk/varer/kod-fisk-fjerkrae/gris), [R-okse](https://shop.rema1000.dk/varer/kod-fisk-fjerkrae/oksekod), [R-lam](https://shop.rema1000.dk/varer/kod-fisk-fjerkrae/lam), [R-fisk](https://shop.rema1000.dk/varer/kod-fisk-fjerkrae/fisk-skaldyr), [R-kfisk](https://shop.rema1000.dk/varer/kol/fisk-sild-skaldyr), [R-pol](https://shop.rema1000.dk/varer/kol/polser), [R-pal](https://shop.rema1000.dk/varer/kol/palaeg), [R-bac](https://shop.rema1000.dk/varer/kol/bacon-toppings), [R-post](https://shop.rema1000.dk/varer/kol/postejpate), [R-KON](https://shop.rema1000.dk/kolonial/konserves-survarer), [R-OLI](https://shop.rema1000.dk/kolonial/olie-eddike-balsamico), [R-KET](https://shop.rema1000.dk/kolonial/ketchup-remoulade-mayonnaise-mv), [R-SAU](https://shop.rema1000.dk/kolonial/saucer-nem-mad), [R-FKON](https://shop.rema1000.dk/kolonial/fiskekonserves), [R-KRY](https://shop.rema1000.dk/kolonial/krydderier), [R-FGR](https://shop.rema1000.dk/varer/frost/grontsager-frugt-baer), [R-FFI](https://shop.rema1000.dk/varer/frost/fisk-skaldyr), [R-FKA](https://shop.rema1000.dk/varer/frost/kartofler), [R-FKO](https://shop.rema1000.dk/varer/frost/kod-fjerkrae). MT = [Mattilsynet 2015 table](https://mattilsynet-xp7prod.enonic.cloud/_/attachment/inline/538de5fa-6f5d-4895-88ab-525d3da9b6cb:2f2f256b6fde0e117a9a6d2139916937eed1504b/mal-vekt-og-porsjonsstorrelser-for-matvarer.ods).

### Vegetables (incl. fruit and fresh herbs)

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Onion | Løg | 1 | kg | 170 (MT) | løg zittauer · [2301096](https://www.nemlig.com/produkt/2301096) | nemlig 1 kg; REMA 1 kg (R-KL) | high |
| Red onion | Rødløg | 1 | kg | 170 (MT) | rødløg · [2301108](https://www.nemlig.com/produkt/2301108) | nemlig 1 kg; REMA 500 g (R-KL) | high |
| Shallot | Skalotteløg | 250 | g | 18–60 (MT) | skalotteløg · [5037916](https://www.nemlig.com/produkt/5037916) | nemlig øko 250 g; REMA 200 g (R-KL) | high |
| Spring onion | Forårsløg | 1 | bundt | 20 per stem (MT) | forårsløg · [2301119](https://www.nemlig.com/produkt/2301119) | nemlig 1 bdt; REMA 1 bdt (R-SF) | high |
| Garlic, net | Hvidløg i net | 200 | g | bulb 55; clove 2.5 (MT) | hvidløg i net · [5053384](https://www.nemlig.com/produkt/5053384) | nemlig 200 g; REMA 90 g (R-KL) | high |
| Garlic, single bulb | Hvidløg øko. | 1 | stk | 55 (MT) | hvidløg · 100160 (n.o.) | REMA øko 1 stk (R-KL) | med |
| Leek | Porre | 1 | stk | 250 (MT) | porrer | REMA 1 stk (R-GG) | high |
| Carrot | Gulerødder | 2 | kg | 80 (REMA loose); MT 60/90/140 | gulerødder · [3001016](https://www.nemlig.com/produkt/3001016) | nemlig 2 kg; REMA 1 kg (R-GG) | high |
| Potato | Kartofler | 2 | kg | 70 (REMA loose); MT 65 | kartofler · [2301087](https://www.nemlig.com/produkt/2301087) | nemlig 2 kg; REMA 1 kg, 1.5 kg, 2 kg (R-KL) | high |
| Baking potato | Bagekartofler | 2 | kg | ~120+ (MT "L") | bagekartofler · [5006405](https://www.nemlig.com/produkt/5006405) (alt 1.5 kg [5059035](https://www.nemlig.com/produkt/5059035)) | REMA 1.5 kg (R-KL) | high |
| Small / new potatoes | Små kartofler / asparges kartofler | 650 | g | 35 (MT) | små kartofler (n.o.) | REMA 650 g (R-KL) | med |
| Sweet potato | Søde kartofler | 1 | stk | 180 (MT) | søde kartofler (n.o.) | REMA 1 stk (R-KL) | med |
| Celeriac | Knoldselleri | 1 | stk | 780 (MT) | knoldselleri | REMA øko 1 stk; loose per kg (R-GG) | high |
| Parsnip | Pastinak | loose | kg | 130 (REMA loose) | pastinakker | REMA vej selv (R-GG) | med |
| Parsley root | Persillerod | loose | kg | 100 | persillerødder | REMA vej selv (R-GG) | med |
| Jerusalem artichoke | Jordskokker | loose | kg | 25 (MT) | jordskokker | REMA vej selv (R-GG) | med |
| Beetroot | Rødbeder | 1 | kg | 100 (REMA loose); MT 140 | rødbeder | REMA øko 1 kg (R-GG) | high |
| White cabbage | Hvidkål | 1 | stk | 1250 (MT) | hvidkål · [5012293](https://www.nemlig.com/produkt/5012293) | nemlig 1 stk "small"; REMA per kg (R-K) | high |
| Red cabbage | Rødkål | 1 | stk | 1500 (MT) | rødkål | REMA øko 1 stk (R-K) | high |
| Pointed cabbage | Spidskål | 1 | stk | 1000 (MT) | spidskål · [1101037](https://www.nemlig.com/produkt/1101037) | nemlig 1 stk; REMA 1 stk (R-K) | high |
| Savoy cabbage | Savoykål | 1 | stk | unknown | savoykål · [5005500](https://www.nemlig.com/produkt/5005500) | nemlig øko 1 stk | high (pack) / low (weight) |
| Chinese cabbage | Kinakål | 1 | stk | 800 (MT) | kinakål · 2301093 (n.o.) | not opened | low |
| Kale | Grønkål | 300 | g | – | grønkål · [5005499](https://www.nemlig.com/produkt/5005499) | nemlig øko 300 g; REMA 400 g (R-K) | high |
| Cauliflower | Blomkål | 1 | stk | 650 (MT) | blomkål · [5012627](https://www.nemlig.com/produkt/5012627) | nemlig 1 stk; REMA 1 stk (R-K) | high |
| Broccoli | Broccoli | 500 | g | 460 per head (MT) | broccoli · [2301185](https://www.nemlig.com/produkt/2301185) | nemlig 500 g; REMA 1 stk (R-K) | high |
| Brussels sprouts | Rosenkål | 400 | g | 15 (MT) | rosenkål (n.o.) | REMA 400 g (R-K) | high (REMA) |
| Pak choi | Pak choi | 300 | g | – | pak choi | REMA 300 g (R-K) | high (REMA) |
| Kohlrabi | Kålrabi | 1 | stk | 240 (MT) | kålrabi (n.o.) | not opened | low |
| Cucumber | Agurk | 1 | stk | 335 (MT) | agurk · [2301199](https://www.nemlig.com/produkt/2301199) | nemlig 1 stk; REMA 1 stk (R-AT) | high |
| Tomatoes (tray) | Tomater | 400 | g | 120 (REMA loose); MT 95 | danske tomater · [5026330](https://www.nemlig.com/produkt/5026330) | nemlig 400 g; REMA øko 400 g (R-AT) | high |
| Cherry tomatoes | Cherrytomater | 200 | g | 15 (MT) | cherrytomater · [5014513](https://www.nemlig.com/produkt/5014513) | nemlig 200 g; REMA 250 g (R-AT) | high |
| Red pepper | Peberfrugt rød | 1 | stk | 170 (MT) | peberfrugt rød · [2301103](https://www.nemlig.com/produkt/2301103) | REMA 1 stk (R-AT) | high |
| Mixed peppers | Peberfrugt mix | 3 | stk | 170 (MT) | peberfrugt mix · [2301180](https://www.nemlig.com/produkt/2301180) | nemlig 3 stk | high |
| Snack peppers | Snackpeber | 200 | g | – | snackpeber | REMA 200 g øko / 500 g (R-AT) | high (REMA) |
| Red chili | Chili rød | 70 | g | 10 (MT) | chili rød (n.o.) | REMA chili mix 70 g (R-KR) | med |
| Courgette | Squash | 1 | stk | 300 (MT) | squash | REMA 1 stk (R-SF) | high (REMA) |
| Aubergine | Aubergine | 1 | stk | 350 (MT) | aubergine | REMA 1 stk (R-SF) | high (REMA) |
| Hokkaido pumpkin | Hokkaido græskar | 1 | stk | unknown (~1000–1500?) | hokkaido | REMA øko 1 stk (R-GG) | high (pack) / low (weight) |
| Butternut squash | Butternut | 1 | stk | unknown | butternut | REMA øko 1 stk (R-GG) | high (pack) / low (weight) |
| Champignon | Champignon | 500 | g | 20 (MT) | champignon · [5010800](https://www.nemlig.com/produkt/5010800) | nemlig 500 g; REMA 250 g / 400 g (R-SF) | high |
| Brown champignon | Brune champignon | 250 | g | 20 | brune champignon (n.o.) | not opened | low |
| Shiitake | Shii-take | 100 | g | 8 | shii-take · [5002556](https://www.nemlig.com/produkt/5002556) | nemlig øko 100 g | high |
| Portobello | Portobello | 2 | stk | ~125 | portobello · [5018684](https://www.nemlig.com/produkt/5018684) | nemlig 2 stk; REMA 250 g (R-SF) | high |
| Mixed mushrooms | Svampemix | 200 | g | – | svampemix | REMA 200 g (R-SF) | high (REMA) |
| Iceberg lettuce | Icebergsalat | 1 | stk | 510 (MT) | iceberg salat · [5004705](https://www.nemlig.com/produkt/5004705) | nemlig 1 stk; REMA 1 stk (R-SF) | high |
| Romaine / heart lettuce | Hjertesalat / romaine | 1 | pose (2 hearts) | unknown | hjertesalat (n.o.) | REMA 1 pose (R-SF) | med |
| Mixed salad leaves | Salatmix | 75 | g | – | salat mix (n.o.) | REMA 75 g (R-SF) | high (REMA) |
| Rocket | Rucola | 100 | g | – | rucola · [5021835](https://www.nemlig.com/produkt/5021835) | nemlig øko 100 g; REMA 75 g (R-SF) | high |
| Baby spinach | Babyspinat | 100 | g | – | babyspinat · [5021833](https://www.nemlig.com/produkt/5021833) | nemlig øko 100 g; REMA spinat 250 g (R-SF) | high |
| Green beans | Bønner haricots verts | 150 | g | 3 per bean (MT) | bønner haricots verts · [102729](https://www.nemlig.com/produkt/102729) | nemlig 150 g; REMA 250 g (R-GG) | high |
| Sugar snap peas | Sugar snaps | 125 | g | 3.5 (MT) | sugar snaps | REMA 125 g (R-SF) | high (REMA) |
| Bean sprouts | Bønnespirer | 150 | g | – | bønnespirer · [2301116](https://www.nemlig.com/produkt/2301116) | nemlig øko 150 g | high |
| Fennel | Fennikel | 1 | stk | 150 (MT) | fennikel · [5011093](https://www.nemlig.com/produkt/5011093) | nemlig øko 1 stk; REMA 1 stk (R-GG) | high |
| Celery | Bladselleri | 1 | stk (head) | 500 head; 33 per stalk (MT) | bladselleri | REMA øko 1 stk (R-SF) | high (REMA) |
| Radishes | Radiser | 1 | bundt | 4.2 each (MT) | radiser | REMA 1 bdt (R-SF) | high (REMA) |
| Fresh ginger | Ingefær | 200 | g | ~3 g per cm (MT) | ingefær · [5016560](https://www.nemlig.com/produkt/5016560) | nemlig øko 200 g; REMA 200 g (R-KR) | high |
| Turmeric root | Gurkemejerod | 50 | g | – | gurkemejerod | REMA øko 50 g (R-KR) | high (REMA) |
| Corn on the cob | Majskolbe | ? | stk | 250 (MT) | majs | out of season | low |
| Asparagus | Asparges | ? | bundt | 30 per spear (MT) | asparges | out of season | low |
| Rhubarb | Rabarber | ? | bundt/kg | 135 per stalk (MT) | rabarber | out of season | low |
| Avocado | Avocado | 1 | stk | 175–300 (MT) | avocado (n.o.) | REMA 1 stk / 1 bakke (R-SF) | high (REMA) |
| Lemon | Citron | 1 | stk | 150 (MT) | citron (n.o.) | REMA 1 stk; øko 250 g (R-PA) | high (REMA) |
| Lime | Lime | 1 | stk | 80 (MT); min 60 (REMA) | lime (n.o.) | REMA øko 1 stk (R-PA) | high (REMA) |
| Orange | Appelsin | 1 | stk | 150–350 (MT) | appelsiner | REMA 1 stk; 2 kg (R-PA) | high (REMA) |
| Clementines | Clementiner | 1 | kg | 80–110 (MT) | clementiner | REMA 1 kg; øko 500 g (R-PA) | high (REMA) |
| Apple | Æbler | 1 | stk | 140 (MT) | æbler | REMA 1 stk; 1.5 kg bag (R-PA) | high (REMA) |
| Pear | Pærer | 1 | stk | 160–230 (MT) | pærer | REMA 1 stk; 1 kg tray (R-PA) | high (REMA) |
| Banana | Banan | 1 | stk | 180 (MT) | banan | REMA 1 stk; øko 1 bdt (R-PA) | high (REMA) |
| Grapes, seedless | Druer stenfri | 500 | g | 4 (MT) | druer | REMA 500 g (R-MB) | high (REMA) |
| Blueberries | Blåbær | 125 | g | – | blåbær | REMA 125 g (R-MB) | high (REMA) |
| Raspberries | Hindbær | 125 | g | 5 (MT) | hindbær | REMA 125 g (R-MB) | high (REMA) |
| Blackberries | Brombær | 125 | g | 6 (MT) | brombær | REMA 125 g (R-MB) | high (REMA) |
| Strawberries | Jordbær | ? | g | 10–30 (MT) | jordbær (n.o.) | out of season | low |
| Mango | Mango | 1 | stk | 470 (MT) | mango | REMA 1 stk (R-MB) | high (REMA) |
| Pineapple | Ananas | 1 | stk | 1300 (MT) | ananas | REMA 1 stk (R-MB) | high (REMA) |
| Kiwi | Kiwi | 1 | stk | 100 (MT) | kiwi | REMA 1 stk (R-BK) | high (REMA) |
| Melon | Melon | 1 | stk | 550–800 (MT) | cantaloupe melon | REMA 1 stk (R-MB) | high (REMA) |
| Pomegranate | Granatæble | 1 | stk | 285 (MT) | granatæble | REMA 1 stk (R-MB) | high (REMA) |
| Plum | Blommer | 1 | stk | 55 (MT) | blommer | REMA 1 stk (R-BK) | high (REMA) |
| Passion fruit | Passionsfrugt | 1 | stk | 30 (MT) | passionsfrugt | REMA 1 stk (R-MB) | high (REMA) |
| Grapefruit | Grapefrugt | 1 | stk | 260 (MT) | grape | REMA øko 1 stk (R-PA) | high (REMA) |
| Fresh dates | Friske dadler | 400 | g | – | dadler | REMA 400 g (R-MB) | high (REMA) |
| Parsley | Persille | 1 | stk (pot) | unknown | persille | REMA 1 stk; bredbladet 1 stk (R-KR) | med |
| Coriander | Koriander | 1 | stk (pot) | unknown | koriander | REMA øko 1 stk (R-KR) | med |
| Basil | Basilikum | 1 | stk (pot) | unknown | basilikum | REMA øko 1 stk (R-KR) | med |
| Dill | Dild | 1 | stk (pot) | unknown | dild | REMA 1 stk (R-KR) | med |
| Chives | Purløg | 1 | stk (pot) | unknown | purløg | REMA 1 stk (R-KR) | med |
| Mint | Mynte | 1 | stk | unknown | mynte | REMA øko 1 stk (R-KR) | med |
| Thyme | Timian | 1 | stk | unknown | timian | REMA øko 1 stk (R-KR) | med |
| Rosemary | Rosmarin | 1 | stk | unknown | rosmarin | REMA øko 1 stk (R-KR) | med |
| Cress | Karse | 1 | stk | – | karse | REMA 1 stk (R-KR) | high (REMA) |

### Bread (incl. chilled doughs)

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Rye bread | Rugbrød | 900 | g | – | rugbrød · [5006197](https://www.nemlig.com/produkt/5006197) (Softkerne, Lagkagehuset) | REMA 500 g house brand; 950–1120 g (R-RUG) | high |
| Toast bread | Hvedetoast | 600 | g | – | toastbrød · [5070215](https://www.nemlig.com/produkt/5070215) | REMA 375 g (R-BRD) | high |
| White sandwich loaf | Franskbrød / hvedesandwich | 500 | g | – | franskbrød | REMA hvedesandwich 500 g (R-BRD) | med |
| Burger buns | Burgerboller | 330 | g | ~80 (4 stk, inferred) | burgerboller | REMA 330 g; Hatting 320 g (R-FF) | high (g) / low (count) |
| Hot dog buns | Pølsebrød | 14 | stk (430 g) | 31 | pølsebrød · [5071403](https://www.nemlig.com/produkt/5071403) | REMA 430 g (R-FF) | high |
| French hot dog bread | Fransk hotdogbrød | 240 | g | – | fransk hotdog brød | REMA 240 g (R-FF) | high (REMA) |
| Naan | Naanbrød | 2 | stk (260 g) | 130 | naan · [5066058](https://www.nemlig.com/produkt/5066058) | REMA 260 g (R-FF) | high |
| Baguette / flutes | Baguettes / flutes | 2 | stk (300 g) | 150 | baguettes · [922583](https://www.nemlig.com/produkt/922583) | REMA flutes 300 g (R-BAG) | high |
| Pita bread | Pitabrød | 170 | g | count unknown | pitabrød · [5046008](https://www.nemlig.com/produkt/5046008) | REMA BFree 220 g (R-FF) | high (g) |
| Wheat tortillas | Tortillas | 370 | g | ~46 (8 stk, inferred) | tortilla (nemlig SKU not found) | REMA 370 g; øko 320 g (R-TEX) | high (g) / low (count) |
| Taco shells | Tacoskaller | 12 | stk (135 g) | ~11 | tacoskaller | REMA 135 g (R-TEX); count typical | med |
| Crispbread | Knækbrød | 200 | g | – | fuldkornsknækbrød · [5029082](https://www.nemlig.com/produkt/5029082) | nemlig Leksands 200 g | high |
| Rye rolls | Rugbrødsboller | 500 | g | – | rugbrødsboller | REMA Kohberg 500 g (R-BOL) | high (REMA) |
| Buns | Boller | 500 | g | – | boller | REMA 380–500 g (R-BOL) | high (REMA) |
| Pizza dough, fresh roll | Pizzadej | 400 | g | – | pizzadej (nemlig has only frozen "Pizzadej m. surdej øko." 5047851, n.o.) | REMA Humlum 400 g (R-DEJ) | high (REMA) |
| Pizza bases, pre-baked | Pizzabunde | 2 | stk (400 g) | 200 | pizzabund · [5046254](https://www.nemlig.com/produkt/5046254) | nemlig chilled | high |
| Puff pastry, chilled roll | Butterdej | 275 | g | – | butterdej · [5068595](https://www.nemlig.com/produkt/5068595) | nemlig Gestus 275 g; REMA 275 g (R-DEJ) | high |
| Shortcrust, chilled roll | Tærtedej | 275 | g | – | tærtedej | REMA Humlum 275 g (R-DEJ) | high (REMA) |
| Croissant dough | Croissantdej | 240 | g | – | croissants dej | REMA 240 g (R-DEJ) | high (REMA) |
| Tartlet shells | Tarteletter | 10 | stk | ~12–15 | tarteletter | not found at REMA or nemlig | low |

### Dairy (incl. eggs, cheese, fats, yeast, plant drinks)

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Whole milk | Sødmælk 3,5% | 1 | l | – | sødmælk · [701016](https://www.nemlig.com/produkt/701016) | REMA 1 l (R-MEJ) | high |
| Semi-skimmed milk | Letmælk 1,5% | 1 | l | – | letmælk | REMA 1 l (R-MEJ) | high |
| Low-fat milk | Minimælk 0,4% | 1 | l | – | minimælk | REMA 1 l (R-MEJ) | high |
| Skimmed milk | Skummetmælk 0,1% | 1 | l | – | skummetmælk | REMA 1 l (R-MEJ) | high |
| Buttermilk | Kærnemælk 0,3% | 1 | l | – | kærnemælk · [701009](https://www.nemlig.com/produkt/701009) | nemlig 1 l | high |
| Kefir | Kefir naturel | 1 | l | – | kefir | REMA Cultura 1 l (R-SYR) | high (REMA) |
| Whipping cream 36% | Piskefløde 36% | 0.25 | l | – | piskefløde 36% · [5005345](https://www.nemlig.com/produkt/5005345) | REMA house 0.5 l; Karolines 0.25 l (R-FLO) | high |
| Whipping cream 38% organic | Piskefløde 38% øko. | 0.25 | l | – | piskefløde 38% øko · [5042393](https://www.nemlig.com/piskefloede-38-oeko-5042393) | REMA 0.5 l / 330 ml (R-FLO) | high |
| Cooking cream 8% | Madlavningsfløde 8% | 0.5 | l | – | madlavningsfløde 8% · [5003902](https://www.nemlig.com/produkt/5003902) | REMA 250 ml / 330 ml (R-FLO) | high |
| Cooking cream 13–15% | Madlavningsfløde 15% | 250 | ml | – | madlavningsfløde 15% | REMA 250 ml; 13% 300 ml (R-FLO) | high (REMA) |
| Cremefine | Cremefine 7% / 15% | 250 | ml | – | cremefine | REMA 250 ml (R-FLO) | high (REMA) |
| Coffee cream | Kaffefløde 10% | 250 | ml | – | kaffefløde | REMA 250 ml (R-FLO) | high (REMA) |
| Crème fraîche 18% | Creme fraiche 18% | 250 | g | – | creme fraiche 18% · [2301048](https://www.nemlig.com/produkt/2301048) | REMA house 500 g; Karolines 250 g (R-SYR) | high |
| Crème fraîche 38% | Creme fraiche 38% | 250 | g | – | creme fraiche 38% · [5020119](https://www.nemlig.com/produkt/5020119) | REMA Gram Slot 190 g (R-SYR) | high |
| Light crème fraîche 9% | Fraiche 9% | 500 | g | – | fraiche 9% · [5052849](https://www.nemlig.com/produkt/5052849) | REMA 500 g; 190 g (R-SYR) | high |
| Plain yoghurt A38 | A38 naturel | 1 | l (≈1 kg) | – | a38 naturel · [5005926](https://www.nemlig.com/produkt/5005926) | REMA prints 1 kg (R-SYR) | high |
| Plain yoghurt | Yoghurt naturel | 1 | kg | – | yoghurt naturel | REMA Kløver 1 kg (R-YOG) | high (REMA) |
| Greek yoghurt 10% | Græsk yoghurt 10% | 1 | kg | – | græsk yoghurt | REMA 1 kg; øko 400 g (R-YOG) | high (REMA) |
| Skyr | Skyr naturel | 1 | kg | – | skyr naturel | REMA 1000 g (R-YOG) | high (REMA) |
| Ymer | Ymer | 1 | kg | – | ymer | REMA Arla øko 1 kg (R-SYR) | high (REMA) |
| Tykmælk | Tykmælk | 1 | kg | – | tykmælk | REMA 1 kg (R-SYR) | high (REMA) |
| Quark | Kvark | 500 | g | – | kvark | not found | low |
| Butter | Smør | 200 | g | – | smør | REMA Lurpak / house / Arla øko 200 g (R-SMO) | high (REMA) |
| Spreadable butter | Smørbar | 200 | g | – | smørbar | REMA Lurpak / Kærgården 200 g (R-SMO) | high (REMA) |
| Plant butter | Plantebaseret smørbar | 200 | g | – | plantebaseret smør | REMA 200 g (R-SMO) | high (REMA) |
| Margarine, block | Margarine | 500 | g | – | margarine | REMA 500 g (R-MAR) | high (REMA) |
| Liquid margarine | Flydende margarine | 500 | ml | – | flydende margarine | REMA 500 ml (R-MAR) | high (REMA) |
| Eggs, 10-pack | Skrabeæg str. M/L | 10 | stk | 60 | skrabeæg · [5003310](https://www.nemlig.com/produkt/5003310) | REMA 10 stk; 15 stk S/M ≈53 g; 6 and 8 stk (R-AEG) | high |
| Eggs, organic | Æg str. M/L øko. | 10 | stk | 60 | æg øko · [5011121](https://www.nemlig.com/aeg-str-m-l-oeko-5011121) (count not printed) | REMA 10 stk / 8 stk (R-AEG) | high (REMA) |
| Egg whites, liquid | Æggehvider | 230 | g | – | æggehvider | REMA Dava 230 g (R-AEG) | high (REMA) |
| Fresh yeast | Gær | 50 | g | 50 (cube) | gær | standard cube; no page fetched | med |
| Oat drink | Havredrik | 1 | l | – | havredrik · [5061428](https://www.nemlig.com/produkt/5061428) | nemlig Naturli' 1 l | high |
| Soy drink | Soyadrik | 1 | l | – | soyadrik · 5030235 (n.o.) | not opened | low |
| Plant cream | Plantefløde (piskbar) | 250 | ml | – | plantefløde | REMA Alpro / Oma 250 ml (R-FLO) | high (REMA) |
| Grated mozzarella | Mozzarella revet | 200 | g | – | revet mozzarella · [709002](https://www.nemlig.com/produkt/709002) | REMA 200 g / 400 g (R-OST) | high |
| Grated cheddar | Revet cheddar | 150 | g | – | revet cheddar | REMA 150 g; Texmex 150 g (R-OST) | high (REMA) |
| Grated hard cheese | Revet parmesan | 100 | g | – | revet parmesan | REMA Ambrosi 100 g (R-OST) | high (REMA) |
| Parmesan block | Parmigiano Reggiano | 200 | g | – | parmigiano · [5066312](https://www.nemlig.com/produkt/5066312) | nemlig 200 g | high |
| Mozzarella ball | Mozzarella | 125 | g | 125 | mozzarella · [5009664](https://www.nemlig.com/produkt/5009664) | REMA 125 g (R-OST) | high |
| Burrata | Burrata | 125 | g | 125 | burrata · [5041403](https://www.nemlig.com/produkt/5041403) | nemlig 125 g | high |
| Ricotta | Ricotta | 250 | g | – | ricotta · [5009667](https://www.nemlig.com/produkt/5009667) | nemlig 250 g | high |
| Mascarpone | Mascarpone | 250 | g | – | mascarpone · [5009663](https://www.nemlig.com/produkt/5009663) | REMA 250 g (R-OST) | high |
| Feta | Fetaost | 150 | g | – | fetaost · [5047128](https://www.nemlig.com/produkt/5047128) | nemlig 150 g | high |
| Feta-style cubes | Salatost i tern | 325 | g | – | salatost · [5000756](https://www.nemlig.com/produkt/5000756) | nemlig 325 g | high |
| Halloumi | Grillost | 250 | g | – | grillost · [5030822](https://www.nemlig.com/produkt/5030822) | nemlig 250 g | high |
| Goat cheese log | Gederulle | 180 | g | – | gederulle · [5045513](https://www.nemlig.com/produkt/5045513) | nemlig 180 g | high |
| Cottage cheese | Hytteost | 450 | g | – | hytteost | REMA 450 g; 200 g / 250 g (R-OST) | high (REMA) |
| Cream cheese | Flødeost naturel (Philadelphia) | 200 | g | – | philadelphia | REMA 200 g (R-OST) | high (REMA) |
| Piquant cream cheese | Pikant flødeost | 200 | g | – | buko pikant | REMA Buko 200 g (R-OST) | high (REMA) |
| Sliced cheese 45+ | Ost i skiver ML 45+ | 300 | g | – | ost i skiver | REMA 300 g; 240 / 250 g (R-OST) | high (REMA) |
| Block cheese 45+ | Ost i stykke 45+ | ~550 | g (variable) | – | ost i stykke | REMA Klovborg 552 g (R-OST) | med |
| Cheddar block | Cheddar | 200 | g | – | cheddar | REMA 200 g (R-OST) | high (REMA) |
| Brie | Brie | 200 | g | – | brie | REMA 200 g (R-OST) | high (REMA) |
| Havarti | Havarti | 200 | g | – | havarti | REMA 200 g (R-OST) | high (REMA) |
| Fresh pasta / tortellini | Frisk pasta | 250 | g | – | frisk pasta | not verified | low |

### Meat & fish (incl. pålæg)

Variable-weight cuts are shown as the midpoint of the printed range. The app should model these as "1 piece ≈ X kg".

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Minced beef 8–12% | Hakket oksekød 8-12% | 500 | g | – | hakket oksekød 8-12% · [5063170](https://www.nemlig.com/produkt/5063170) (1 kg [5027572](https://www.nemlig.com/produkt/5027572)) | REMA 400 g / 800 g (R-hak) | high |
| Minced beef 4–7% | Hakket oksekød 4-7% | 500 | g | – | hakket oksekød 4-7% · [5063169](https://www.nemlig.com/produkt/5063169) (1 kg [5027568](https://www.nemlig.com/produkt/5027568)) | REMA 350 g (R-hak) | high |
| Minced beef 14–18% | Hakket oksekød 14-18% | 500 | g | – | hakket oksekød 14-18% · [5063171](https://www.nemlig.com/produkt/5063171) | REMA 400 g (R-hak) | high |
| Minced pork 8–12% | Hakket grisekød 8-12% | 400 | g | – | hakket grisekød · [5058405](https://www.nemlig.com/produkt/5058405) (1 kg [5026540](https://www.nemlig.com/produkt/5026540)) | REMA 500 g (R-hak) | high |
| Minced pork & veal | Hakket grise- og kalvekød 8-12% | 500 | g | – | hakket grise og kalvekød · [5026536](https://www.nemlig.com/produkt/5026536) (1 kg [5026539](https://www.nemlig.com/produkt/5026539)) | REMA 500 g (R-hak) | high |
| Minced veal | Hakket kalvekød | 500 | g | – | hakket kalvekød · [5065265](https://www.nemlig.com/produkt/5065265) | nemlig 500 g | med |
| Minced chicken | Hakket kyllingekød | 400 | g | – | hakket kyllingekød · [5055317](https://www.nemlig.com/produkt/5055317) | REMA 400 g (R-hak) | high |
| Minced lamb | Hakket lammekød | 400 | g | – | hakket lam | not found | low |
| Chicken breast fillet | Kyllingebrystfilet | 650 | g | ~150 (Kalu 170) | kyllingebrystfilet · [5064235](https://www.nemlig.com/produkt/5064235) (alt 450 g [5604407](https://www.nemlig.com/produkt/5604407), 1.2 kg [5069891](https://www.nemlig.com/produkt/5069891)) | REMA 650 g / 280 g (R-kyl) | high (pack) / med (piece) |
| Chicken inner fillet | Kyllingeinderfilet | 300 | g | – | kyllingeinderfilet · [5064232](https://www.nemlig.com/produkt/5064232) | REMA 350 g / 600 g (R-kyl) | high |
| Chicken thighs, bone-in | Kyllingeoverlår | 800 | g | ~190 | kyllingeoverlår · [5064233](https://www.nemlig.com/produkt/5064233) | REMA 800 g (R-kyl) | high |
| Chicken thigh fillet | Kyllingelårfilet | 400 | g | – | kyllingelårfilet | REMA 400 g (R-kyl) | med |
| Chicken drumsticks | Kyllingeunderlår | 700 | g | ~100–120 (inferred) | kyllingeunderlår · [5064236](https://www.nemlig.com/produkt/5064236) | REMA 700 g (R-kyl) | high (pack) / low (piece) |
| Chicken wings | Kyllingevinger | 500 | g | – | kyllingevinger | REMA 500 g; nemlig hot wings 1 kg [5602555](https://www.nemlig.com/produkt/5602555) | med |
| Whole chicken | Hel kylling | 1.35 | kg | 1350 | hel kylling · [5056389](https://www.nemlig.com/produkt/5056389) | REMA 1350 g (R-kyl) | high |
| Pork tenderloin | Mørbrad af gris | 1.2 | kg (2 stk) | ~600 | mørbrad af gris · [5018915](https://www.nemlig.com/produkt/5018915) | REMA 0.6 kg single (R-gris) | high |
| Pork neck chops | Nakkekoteletter | 500 | g | ~110 (4–5 stk) | nakkekoteletter · [5069205](https://www.nemlig.com/produkt/5069205) | REMA 300 g (R-gris) | high |
| Pork chops | Koteletter af gris | 500 | g | – | koteletter af gris · [5062489](https://www.nemlig.com/produkt/5062489) | REMA 400 g (R-gris) | high |
| Roast pork with rind | Flæskesteg | 1.5 | kg (range 1.4–1.6) | – | flæskesteg · [5067616](https://www.nemlig.com/produkt/5067616) | REMA 1.45 kg (R-gris) | high |
| Pork belly slices | Stegeflæsk i skiver | 500 | g | – | stegeflæsk i skiver · [5020074](https://www.nemlig.com/produkt/5020074) | REMA 400 g (R-gris) | high |
| Pork neck fillet | Nakkefilet | 1 | kg | – | nakkefilet | REMA 1 kg (R-gris) | med |
| Medister sausage | Medisterpølse | 500 | g | – | medister | REMA 500 g (R-gris) | high (REMA) |
| Bacon, diced | Bacon i tern | 200 | g (2 × 100) | – | bacon i tern | REMA 200 g 2-pk (R-bac) | high (REMA) |
| Bacon, sliced | Bacon i skiver | 150 | g | – | bacon i skiver | REMA 150 g (R-bac) | high (REMA) |
| Ham strips | Skinkestrimler | 200 | g (2 × 100) | – | skinkestrimler | REMA 200 g (R-bac) | med |
| Grill sausages | Grillpølser | 550 | g | ~55 (guess) | grillpølser | REMA 550 g (R-pol) | med (pack) / low (piece) |
| Frankfurters | Wienerpølser | 375 | g | ~47 (guess) | wienerpølser | REMA 375 g / 500 g (R-pol) | med (pack) / low (piece) |
| Cocktail sausages | Cocktailpølser | 125 | g | – | cocktailpølser | not verified | low |
| Kale sausages | Kålpølser | 320 | g (4 stk) | 80 | kålpølser | REMA 320 g (R-pol) | high (REMA) |
| Chorizo | Chorizo | 80 | g | – | chorizo | REMA Taga 80 g (R-pal) | med |
| Beef tenderloin | Oksemørbrad | 1.6 | kg (range 1.4–1.8) | – | oksemørbrad · [5061120](https://www.nemlig.com/produkt/5061120) | nemlig | med |
| Beef rump roast | Okseculotte | 1.65 | kg (range 1.5–1.8) | – | okseculotte · [5607045](https://www.nemlig.com/produkt/5607045) | REMA 1.15 kg (R-okse) | high |
| Entrecote | Entrecote | 300 | g (2 stk) | 150 | entrecote · [5605143](https://www.nemlig.com/produkt/5605143) | REMA 360 g (R-okse) | high |
| Topside steaks | Tykstegsbøffer | 300 | g | – | bøffer | REMA 300 g (R-okse) | med |
| Beef patties | Hakkebøffer | 250 | g | – | hakkebøffer | REMA 250 g (R-okse) | med |
| Diced beef (goulash) | Oksekød i tern | 600 | g (range 575–625) | – | oksekød i tern · [5607005](https://www.nemlig.com/produkt/5607005) | REMA 300 g (R-okse) | high |
| Leg of lamb | Lammekølle m. ben | 2.3 | kg (range 2.1–2.5) | – | lammekølle · [5607006](https://www.nemlig.com/produkt/5607006) | nemlig | med |
| Lamb rump | Lammeculotte | 450 | g (range 400–500) | – | lammeculotte · [5601692](https://www.nemlig.com/produkt/5601692) | REMA 300 g (R-lam) | med |
| Rullepølse | Rullepølse | 150 | g | – | rullepølse · [5048150](https://www.nemlig.com/produkt/5048150) | REMA 140 g (R-pal) | high |
| Smoked ham pålæg | Hamburgerryg | 140 | g | – | hamburgerryg | REMA 140 g (R-pal) | high (REMA) |
| Boiled ham pålæg | Kogt skinke | 140 | g | – | kogt skinke | REMA 140 g (R-pal) | high (REMA) |
| Chicken pålæg | Kyllingebryst pålæg | 120 | g | – | kyllingebryst pålæg | REMA 120 g (R-pal) | med |
| Smoked turkey pålæg | Kalkunbryst (røget) | 90 | g | – | kalkunbryst · [5602660](https://www.nemlig.com/produkt/5602660) | nemlig 90 g | med |
| Roast beef pålæg | Roastbeef | 70 | g | – | roastbeef | REMA 70 g (R-pal) | med |
| Salami | Spegepølse | 80 | g | – | spegepølse · [5056005](https://www.nemlig.com/produkt/5056005) | REMA 100 g (R-pal) | med |
| Liver pâté | Leverpostej | 500 | g | – | leverpostej | REMA 500 g; 200 / 400 g (R-post) | high (REMA) |
| Salmon, fresh | Lakseportioner / laksefilet | 380 | g | ~110–125 (inferred) | lakseportioner · [5061369](https://www.nemlig.com/produkt/5061369) (600 g m. skind [5602181](https://www.nemlig.com/produkt/5602181)) | REMA 225 g / 400 g (R-fisk) | high (pack) / low (piece) |
| Smoked salmon | Røget laks | 100 | g | – | røget laks | REMA 100 g (R-kfisk) | high (REMA) |
| Cod fillet, fresh | Torskefilet | 225 | g | – | torskefilet | REMA 225 g (R-fisk) | med |
| Saithe fillet, fresh | Mørksejfilet | 400 | g | – | mørksejfilet · [5006247](https://www.nemlig.com/produkt/5006247) | REMA 225 g (R-fisk) | high |
| Plaice fillets | Rødspættefilet | 400 | g | 40–75 | rødspættefilet · [5607061](https://www.nemlig.com/produkt/5607061) | REMA 225 g = 3–6 stk (R-fisk) | high |
| Haddock loins | Kullerloins | 300 | g | – | kullerfilet | REMA 300 g (R-fisk) | med |
| Fish mince | Fiskefars | 400 | g | – | fiskefars | REMA 400 g (R-fisk) | high (REMA) |
| Ready fish cakes | Fiskefrikadeller | 280 | g (4 stk) | 70 | fiskefrikadeller | REMA 280 g; mini 200 g = 10 stk (R-fisk) | high (REMA) |
| Shrimp in brine | Rejer i lage | 170 | g | – | rejer i lage | REMA 170 g (R-kfisk) | high (REMA) |
| Marinated herring | Marinerede sild | 300 | g | – | marinerede sild | REMA 300 g (R-kfisk) | med |
| Hot-smoked mackerel | Varmrøget makrel | 100 | g | – | røget makrel | REMA 100 g (R-kfisk) | med |

### Dry goods (pasta, rice, grains, flour, sugar, baking, nuts, seeds, pulses)

Most rows here have **low or med** confidence. nemlig and REMA dry-goods pages could not be rendered when this section was researched, so only pasta, oats and wheat flour were confirmed on a page.

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Spaghetti | Spaghetti | 500 | g | – | spaghetti | nemlig Casa Del Mulino 1 kg ([recipe page](https://www.nemlig.com/opskrifter/groen-spaghetti-parmesan-hasselnoedder-98004151)); 500 g usual | high (1 kg alt) / med (500 g) |
| Penne | Penne rigatoni | 500 | g | – | penne | nemlig Garofalo 500 g ([recipe page](https://www.nemlig.com/opskrifter/gochujang-pasta-med-kylling-98004562)) | high |
| Fusilli | Fusilli | 500 | g | – | fusilli | nemlig Taste of Nature 500 g ([recipe page](https://www.nemlig.com/opskrifter/pasta-pesto-98004296)) | high |
| Lasagne sheets | Lasagneplader | 500 | g | – | lasagneplader | typical | med |
| Macaroni | Makaroni | 500 | g | – | makaroni | typical | med |
| Tagliatelle | Tagliatelle | 500 | g | – | tagliatelle | typical; egg 250 g | med |
| Basmati rice | Basmatiris | 1 | kg | – | basmati ris | typical | med |
| Jasmine rice | Jasminris | 1 | kg | – | jasminris | typical | med |
| Boil-in-bag rice | Ris kogeposer | 500 | g (4 × 125) | 125 per bag | ris kogeposer | typical | med |
| Pudding rice | Grødris | 1 | kg | – | grødris | typical | med |
| Risotto rice | Risottoris | 1 | kg | – | risotto ris | typical | low |
| Brown rice | Brune ris | 1 | kg | – | brune ris | typical | low |
| Couscous | Couscous | 500 | g | – | couscous | typical | med |
| Bulgur | Bulgur | 500 | g | – | bulgur | typical | low |
| Quinoa | Quinoa | 400 | g | – | quinoa | typical | low |
| Egg noodles | Ægnudler | 250 | g | – | ægnudler | typical | low |
| Rice noodles | Risnudler | 200 | g | – | risnudler | typical | low |
| Rolled oats, fine | Havregryn finvalsede | 1 | kg | – | havregryn finvalsede | REMA 1 kg ([OFF](https://world.openfoodfacts.org/product/5705830080325/finvalsede-havregryn-rema-1000)); Salling 1 kg ([OFF](https://world.openfoodfacts.org/product/5712873708628/havregryn-finvalsede)); Coop 1 kg ([Tænk](https://taenk.dk/test/havregryn/coop-365-oekologi-finvalsede-havregryn)) | high |
| Rolled oats, coarse | Havregryn grovvalsede | 1 | kg | – | havregryn grovvalsede | typical | med |
| Muesli / granola | Müsli | 750 | g | – | müsli | typical | low |
| Cornflakes | Cornflakes | 500 | g | – | cornflakes | typical | med |
| Wheat flour | Hvedemel | 2 | kg | – | hvedemel | Saltå Kvarn 2 kg; Barilla 1 kg ([Prisjagt](https://prisjagt.dk/product.php?p=6508681)) | high |
| Wholemeal wheat flour | Fuldkornshvedemel | 1 | kg | – | fuldkornshvedemel | Urtekram 1 kg ([Matas](https://www.matas.dk/urtekram/gruppe/helse-sundhed/madvarer/bagning/mel/hvedemel)) | med |
| Rye flour | Rugmel | 1 | kg | – | rugmel | typical | med |
| Spelt flour | Speltmel | 1 | kg | – | speltmel | typical | med |
| Graham flour | Grahamsmel | 1 | kg | – | grahamsmel | typical | med |
| Cracked rye kernels | Knækkede rugkerner | 1 | kg | – | rugkerner | not researched | low |
| Cornflour | Majsstivelse (Maizena) | 400 | g | – | maizena | typical | med |
| Potato starch | Kartoffelmel | 500 | g | – | kartoffelmel | typical | low |
| Sugar | Sukker | 1 | kg | – | sukker | typical | med |
| Icing sugar | Flormelis | 500 | g | – | flormelis | typical | med |
| Brown sugar | Brun farin | 500 | g | – | brun farin | typical | med |
| Vanilla sugar | Vaniljesukker | 100 | g | – | vaniljesukker | typical | low |
| Baking powder | Bagepulver | 100 | g | – | bagepulver | typical | low |
| Baking soda | Natron | 100 | g | – | natron | typical | low |
| Dry yeast | Tørgær | 1 | pk (sachets) | 7–12 per sachet | tørgær | typical | low |
| Cocoa powder | Kakao | 250 | g | – | kakao | typical | low |
| Dark chocolate | Mørk chokolade | 100 | g | 100 (bar) | mørk chokolade | typical | low |
| Chocolate chips | Chokoladeknapper | 200 | g | – | chokoladeknapper | typical | low |
| Marzipan | Marcipan | 200 | g | – | marcipan | not researched | low |
| Golden syrup | Lys sirup | 750 | g | – | sirup | typical | low |
| Raisins | Rosiner | 500 | g | – | rosiner | typical | low |
| Desiccated coconut | Kokosmel | 200 | g | – | kokosmel | typical | low |
| Almonds | Mandler | 200 | g | – | mandler | typical | med |
| Hazelnuts | Hasselnødder | 200 | g | – | hasselnødder | typical | med |
| Walnuts | Valnødder | 200 | g | – | valnødder | typical | med |
| Cashews | Cashewnødder | 200 | g | – | cashewnødder | typical | med |
| Peanuts | Peanuts | 300 | g | – | peanuts | typical | low |
| Pine nuts | Pinjekerner | 100 | g | – | pinjekerner | not researched | low |
| Sunflower seeds | Solsikkekerner | 500 | g | – | solsikkekerner | typical | low |
| Pumpkin seeds | Græskarkerner | 250 | g | – | græskarkerner | typical | low |
| Sesame seeds | Sesamfrø | 200 | g | – | sesamfrø | typical | low |
| Flax seeds | Hørfrø | 500 | g | – | hørfrø | typical | low |
| Chia seeds | Chiafrø | 200 | g | – | chiafrø | typical | low |
| Breadcrumbs | Rasp | 200 | g | – | rasp | typical | low |
| Panko | Panko | 150 | g | – | panko | typical | low |
| Red lentils | Røde linser | 500 | g | – | røde linser | typical | med |
| Green / beluga lentils | Grønne / beluga linser | 500 | g | – | linser | typical | low |
| Yellow split peas | Gule ærter | 500 | g | – | gule ærter | not researched | low |
| Dried chickpeas | Kikærter tørrede | 500 | g | – | kikærter tørrede | typical | low |
| Tortilla chips | Tortilla chips | 185 | g | – | tortilla chips | typical | low |
| Rice paper | Rispapir | 1 | pk | – | rispapir | typical | low |
| Instant noodles | Instant nudler | 1 | stk | 60–85 | instant nudler | typical | med |

### Tins & jars

Pack weights for tins are **net**. Drained weight is noted where it differs.

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Chopped tomatoes | Hakkede tomater | 400 | g | – | hakkede tomater | REMA 400 g (R-KON) | high (REMA) |
| Peeled tomatoes | Flåede tomater | 400 | g | – | flåede tomater | REMA øko 400 g (R-KON) | high (REMA) |
| Tomato paste | Tomatpuré | 140 | g | – | tomatpuré · [5011808](https://www.nemlig.com/tomatpure-5011808) | nemlig Cirio 140 g; REMA 140 g (R-KON) | high |
| Tomato paste, tube | Tomatpuré tube | 200 | g | – | tomatpuré tube | typical | low |
| Passata | Passata | 500 | g | – | passata | REMA 500 g; Cucina 680 g (R-KON, R-SAU) | high (REMA) |
| Pasta sauce | Pastasauce | 400 | g | – | pastasauce | REMA 400 g / 480 g (R-SAU) | high (REMA) |
| Pizza sauce | Pizzasauce | 280 | g | – | pizzasauce | REMA 280 g (R-SAU) | high (REMA) |
| Coconut milk | Kokosmælk | 400 | ml | – | kokosmælk ([5066037](https://www.nemlig.com/kokosmaelk-24-5066037) is 250 ml; light 5–7% [5605127](https://www.nemlig.com/kokosmaelk-5-7-5605127), size not seen) | REMA 400 ml (R-KON) | high (REMA) |
| Chickpeas | Kikærter | 400 | g (240 drained) | – | kikærter | nemlig Økomama 400/240 g; REMA "240 g" = drained (R-KON) | high |
| Kidney beans | Kidneybønner | 400 | g (252 drained) | – | kidneybønner | REMA "252 g" = drained (R-KON) | high |
| Black beans | Sorte bønner | 400 | g (252 drained) | – | sorte bønner | REMA "252 g", net inferred (R-KON) | med |
| White / cannellini / butter beans | Hvide bønner | 400 | g | – | hvide bønner | typical | low |
| Baked beans | Hvide bønner i tomat | 420 | g | – | baked beans | REMA 420 g (R-KON) | high (REMA) |
| Kidney beans in chili sauce | Kidneybønner i chilisauce | 410 | g | – | kidneybønner chili | REMA 410 g (R-TEX) | high (REMA) |
| Lentils, tinned | Linser på dåse | 400 | g | – | linser dåse | typical | low |
| Sweetcorn | Majs | 340 | g (285 drained) | – | majs dåse | REMA "285 g", net inferred (R-KON) | med |
| Tuna in water / oil | Tun i vand / olie | 185 | g (140 drained) | – | tun i vand | REMA "140 g", net inferred; 306 g alt (R-FKON) | med |
| Mackerel in tomato | Makrel i tomat | 125 | g | – | makrel i tomat | REMA 125 g (R-FKON) | high (REMA) |
| Sardines in oil | Sardiner i olie | 120 | g | – | sardiner | REMA 120 g (R-FKON) | high (REMA) |
| Mussels in water | Muslinger i vand | 190 | g (115 drained) | – | muslinger · [5044486](https://www.nemlig.com/produkt/5044486) | nemlig | med |
| Pineapple, tinned | Ananas i stykker | 227 | g (140 drained) | – | ananas dåse | REMA "140 g", net inferred (R-KON) | med |
| Asparagus pieces | Aspargessnitter | 270 | g | – | aspargessnitter | REMA 270 g, net/drained unclear (R-KON) | med |
| Pickled beetroot | Rødbeder | 480 | g | – | rødbeder glas | REMA 480 g (R-KON) | high (REMA) |
| Pickled gherkins | Drueagurker | 400 | g | – | drueagurker | REMA 400 g (R-KON) | high (REMA) |
| Cornichons | Cornichoner | 190 | g | – | cornichoner | REMA 190 g (R-KON) | high (REMA) |
| Cucumber salad | Agurkesalat | 550 | g | – | agurkesalat | typical | low |
| Capers | Kapers | 60 | g | – | kapers | REMA 60 g, probably drained (R-KON) | med |
| Olives | Oliven | 140 | g | – | oliven | REMA 140 g, probably drained (R-KON) | med |
| Sun-dried tomatoes | Soltørrede tomater | 280 | g | – | soltørrede tomater | typical | low |
| Jalapeños | Jalapeños i skiver | 220 | g | – | jalapeños | REMA 220 g (R-TEX) | high (REMA) |
| Green pesto | Grøn pesto | 130 | g | – | pesto | REMA 130 g; øko 90 g (R-SAU) | high (REMA) |
| Red pesto | Rød pesto | 130 | g | – | rød pesto | REMA 130 g (R-SAU) | high (REMA) |
| Red / yellow curry paste | Rød / gul karrypasta | 110 | g | – | rød karrypasta | Blue Dragon 110 g ([Bilka To Go](https://www.bilkatogo.dk/produkt/blue-dragon-gul-karrypasta/17194/)) | med |
| Green curry paste | Grøn karrypasta | 110 | g | – | grøn karrypasta | inferred from red / yellow | low |
| Salsa | Salsa | 315 | g | – | salsa | REMA 315 g (R-TEX) | high (REMA) |
| Taco sauce | Tacosauce | 230 | g | – | tacosauce | REMA 230 g (R-TEX) | high (REMA) |
| Tikka masala sauce | Tikka masala | 350 | g | – | tikka masala | REMA 350 g (R-SAU) | high (REMA) |
| Béarnaise, jar | Bearnaisesauce | 410 | g | – | bearnaise | REMA 410 g | high (REMA) |
| Potatoes in jar | Kartofler i glas | 425 | g | – | kartofler glas | REMA 425 g | high (REMA) |
| Condensed milk | Kondenseret mælk | 397 | g | – | kondenseret mælk | REMA 397 g | high (REMA) |
| Tinned mushrooms | Champignon i skiver | 290 | g | – | champignon i skiver | typical | low |
| Honey | Honning | 450 | g | – | honning | typical | low |
| Jam | Marmelade | 400 | g | – | marmelade | typical | med |
| Peanut butter | Peanutbutter | 350 | g | – | peanutbutter | typical | med |
| Tahini | Tahin | 300 | g | – | tahin | typical | low |

### Spices & sauces (incl. salt, oils, vinegars, condiments, stock)

nemlig's default spice is a Santa Maria glass jar. Dried leafy herbs come in 8–21 g jars and ground spices in 28–49 g jars. REMA's own jars are slightly bigger.

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Fine salt | Bordsalt | 1000 | g | – | bordsalt · 5034897 (n.o.) | REMA Salina 1000 g; 125 g (R-KRY) | high (REMA) |
| Coarse salt | Groft salt | 800 | g | – | groft salt | REMA 800 g; 900 g (R-KRY) | high (REMA) |
| Flaky salt | Flagesalt | 250 | g | – | flagesalt | REMA 250 g (R-KRY) | high (REMA) |
| Black pepper | Sort peber (groft) | 34 | g | – | sort peber · [5034924](https://www.nemlig.com/produkt/5034924) | REMA 50 g (R-KRY) | high |
| Black peppercorns | Sort peber, hel | 50 | g | – | sort peber hel | not read | low |
| White pepper | Hvid peber | 35 | g | – | hvid peber · 5034908 (n.o.) | REMA 35 g (R-KRY) | high (REMA) |
| Sweet paprika | Paprika | 37 | g | – | paprika · [5034919](https://www.nemlig.com/produkt/5034919) | REMA 60 g (R-KRY) | high |
| Smoked paprika | Røget paprika | 37 | g | – | røget paprika · [5034920](https://www.nemlig.com/produkt/5034920) | nemlig | high |
| Ground cumin | Spidskommen | 33 | g | – | spidskommen · [5046117](https://www.nemlig.com/produkt/5046117) | nemlig | high |
| Curry powder | Karry | 34 | g | – | karry · [5046114](https://www.nemlig.com/produkt/5046114) | nemlig | high |
| Turmeric | Gurkemeje | 40 | g | – | gurkemeje | REMA 40 g (R-KRY) | high (REMA) |
| Ground cinnamon | Kanel (stødt) | 40 | g | – | kanel stødt · [5046112](https://www.nemlig.com/produkt/5046112) (210 g tub [5602886](https://www.nemlig.com/produkt/5602886)) | REMA 45 g (R-KRY) | high |
| Cinnamon sticks | Kanel, hel | 22 | g | ~2.5 | kanel hel · 5026707 (n.o.) | REMA 22 g (R-KRY) | high (REMA) |
| Ground cardamom | Kardemomme | 28 | g | – | kardemomme · [5046113](https://www.nemlig.com/produkt/5046113) | nemlig | high |
| Ground ginger | Ingefær, stødt | 18 | g | – | ingefær stødt · 5046111 (n.o.) | REMA 18 g (R-KRY) | high (REMA) |
| Chili flakes | Chili flakes | 28 | g | – | chili flakes · [5034903](https://www.nemlig.com/produkt/5034903) | nemlig | high |
| Cayenne | Cayennepeber | 40 | g | – | cayennepeber · 5046120 (n.o.) | REMA 40 g (R-KRY) | high (REMA) |
| Dried oregano | Oregano | 50 | g (bag) | – | oregano · [5004610](https://www.nemlig.com/produkt/5004610) | REMA jar 15 g (R-KRY) | high |
| Dried thyme | Timian | 15 | g | – | timian · [5046118](https://www.nemlig.com/produkt/5046118) | nemlig | high |
| Dried rosemary | Rosmarin | 21 | g | – | rosmarin · [5046116](https://www.nemlig.com/produkt/5046116) | nemlig | high |
| Dried basil | Basilikum | 10 | g | – | basilikum · [5046119](https://www.nemlig.com/produkt/5046119) | REMA 25 g (R-KRY) | high |
| Dried dill | Dild | 13 | g | – | dild · [5034905](https://www.nemlig.com/produkt/5034905) | nemlig | high |
| Marjoram | Merian | 8 | g | – | merian · [5034915](https://www.nemlig.com/produkt/5034915) | nemlig | high |
| Herbes de Provence | Herbes de Provence | 15 | g | – | herbes de provence · [5066259](https://www.nemlig.com/produkt/5066259) | nemlig | high |
| Bay leaves | Laurbærblade | 50 | g (bag) | ~0.2 per leaf | laurbærblade · [5012400](https://www.nemlig.com/produkt/5012400) | nemlig; smaller jars exist (n.o.) | high |
| Nutmeg, whole | Muskatnød, hel | 10 | g | ~5 | muskatnød · [5026703](https://www.nemlig.com/produkt/5026703) | nemlig | high |
| Nutmeg, ground | Muskatnød, stødt | 35 | g | – | muskatnød stødt · [5034916](https://www.nemlig.com/produkt/5034916) | nemlig | high |
| Cloves | Nelliker | 15 | g | ~0.1 | nelliker · 5026695 (n.o.) | REMA whole 15 g; ground 20 g (R-KRY) | high (REMA) |
| Allspice | Allehånde (stødt) | 20 | g | – | allehånde · [5054767](https://www.nemlig.com/produkt/5054767) | nemlig | high |
| Ground coriander | Koriander (stødt) | 28 | g | – | koriander stødt · [5034913](https://www.nemlig.com/produkt/5034913) | nemlig | high |
| Garam masala | Garam masala | 33 | g | – | garam masala · [5034927](https://www.nemlig.com/produkt/5034927) | nemlig | high |
| Garlic powder | Hvidløgspulver | 49 | g | – | hvidløgspulver · [5034910](https://www.nemlig.com/produkt/5034910) | nemlig | high |
| Onion powder | Løgpulver | 41 | g | – | løgpulver · [5034914](https://www.nemlig.com/produkt/5034914) | nemlig | high |
| Star anise | Stjerneanis | 15 | g | ~0.5 | stjerneanis | REMA 15 g (R-KRY) | high (REMA) |
| Vanilla pod | Vaniljestang | 1 | stk | 1.25 | vaniljestang · [5050684](https://www.nemlig.com/produkt/5050684) | nemlig | high |
| Taco seasoning | Taco krydderi | 40 | g | – | taco krydderi | REMA 40 g (R-TEX) | high (REMA) |
| Olive oil | Olivenolie | 500 | ml | – | olivenolie | REMA 500 ml / 750 ml (R-OLI) | high (REMA) |
| Rapeseed oil | Rapsolie | 1 | l | – | rapsolie | REMA 1 l (R-OLI) | high (REMA) |
| Sunflower oil | Solsikkeolie | 1 | l | – | solsikkeolie | REMA 1 l (R-OLI) | high (REMA) |
| Sesame oil | Sesamolie | 250 | ml | – | sesamolie | REMA 250 ml (R-OLI) | high (REMA) |
| Coconut oil | Kokosolie | 250 | ml | – | kokosolie | REMA 250 ml (R-OLI) | high (REMA) |
| White vinegar | Eddike / lagereddike | 1 | l | – | eddike | REMA 1 l (R-OLI) | high (REMA) |
| Apple cider vinegar | Æblecidereddike | 500 | ml | – | æblecidereddike | REMA 500 ml (R-OLI) | high (REMA) |
| Balsamic vinegar | Balsamico | 250 | ml | – | balsamico | REMA 250 ml (R-OLI) | high (REMA) |
| White wine vinegar | Hvidvinseddike | 250 | ml | – | hvidvinseddike | REMA 250 ml (R-OLI) | high (REMA) |
| Rice vinegar | Riseddike | 250 | ml | – | riseddike | not researched | low |
| Soy sauce | Sojasauce | 500 | ml | – | sojasauce (Kikkoman 0.5 l / 0.15 l on nemlig, ID not captured) | REMA 250 ml (R-SAU) | high |
| Fish sauce | Fiskesauce | 200 | ml | – | fiskesauce (Santa Maria 0.20 l) | nemlig snippet | med |
| Oyster sauce | Østerssauce | 190 | ml | – | østerssauce | Blue Dragon 190 ml ([Bilka To Go](https://www.bilkatogo.dk/produkt/blue-dragon-oesterssauce/72483/)) | med |
| Sweet chili sauce | Sweet chili sauce | 300 | ml | – | sweet chili | typical | low |
| Sriracha | Sriracha | 435 | ml | – | sriracha | typical | low |
| Hoisin sauce | Hoisinsauce | 200 | ml | – | hoisin | typical | low |
| Worcestershire sauce | Worcestershire sauce | 150 | ml | – | worcestershire | typical | low |
| Hot chili sauce | Stærk chilisauce | 210 | g | – | chilisauce | REMA 210 g (R-SAU) | high (REMA) |
| Ketchup | Ketchup | 500 | g | – | ketchup | REMA 520 g; Heinz 460 g (R-KET) | high (REMA) |
| Mayonnaise | Mayonnaise | 400 | g | – | mayonnaise | REMA 400 g; Graasten 375 g (R-KET) | high (REMA) |
| Remoulade | Remoulade | 400 | g | – | remoulade | REMA 400 g; Graasten 375 / 800 g (R-KET) | high (REMA) |
| Aioli | Aioli | 230 | g | – | aioli | REMA 230 g (R-KET) | high (REMA) |
| Dijon mustard | Dijonsennep | 370 | g | – | dijon sennep | REMA Bornier 370 g (R-KET) | high (REMA) |
| Danish mustard | Sennep / sød fransk sennep | 400 | g | – | sennep | REMA 400 g (R-KET) | high (REMA) |
| Wholegrain mustard | Grov sennep | 200 | g | – | grov sennep | typical | low |
| Crispy fried onions | Ristede løg | 200 | g | – | ristede løg | REMA 200 g / 100 g (R-KET) | high (REMA) |
| Beef stock cubes | Oksebouillon | 10 | stk (100 g) | 10 g; 1 cube = 0.5 l | oksebouillon · [911005](https://www.nemlig.com/oksebouillon-911005) | nemlig Knorr 10 stk | high |
| Chicken stock cubes | Hønsebouillon | 10 | stk (100 g) | 10 g; 0.5 l each | hønsebouillon | REMA 100 g (R-SAU) | med |
| Vegetable stock cubes | Grøntsagsbouillon | 10 | stk (100 g) | 10 g; 0.5 l each | grøntsagsbouillon | Knorr listed on nemlig, size not seen | med |
| Liquid stock / fond | Fond | 200 | ml | – | fond (Jürgen Langbein fiskefond 0.20 l) | nemlig snippet | med |
| Gravy browning | Madkulør | 200 | ml | – | kulør | REMA 200 ml | high (REMA) |
| Lemon juice | Citronsaft | 200 | ml | – | citronsaft | REMA 200 ml (R-SAU) | high (REMA) |
| BBQ sauce | BBQ sauce | 500 | ml | – | bbq sauce | typical | low |

Knorr's Nordic bouillon pack says **"En terning opløses i 1/2 liter kogende vand"** ([Knorr label](https://res.cloudinary.com/tokmanni/image/upload/8714100783504_et1.pdf)). The UK 8-pack uses 1 cube per litre ([Tesco](https://www.tesco.com/groceries/en-GB/products/293353047)), so the app should not use UK figures.

### Frozen

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Peas | Ærter (fine) | 575 | g | – | ærter · [801007](https://www.nemlig.com/produkt/801007) | REMA 400 g / 600 g (R-FGR) | high |
| Sweetcorn | Majs | 400 | g | – | majs (Majsblanding 5000172 n.o.) | REMA 400 g (R-FGR) | high (REMA) |
| Mixed vegetables | Grøntsagsblanding | 500 | g | – | grøntsagsblanding | REMA 500 g (R-FGR) | high (REMA) |
| Stir-fry mix | Wokblanding | 450 | g | – | wokblanding | REMA 450 g (R-FGR) | high (REMA) |
| Broccoli | Broccoli frost | 400 | g | – | broccoli frost | REMA 400 g (R-FGR) | high (REMA) |
| Chopped spinach | Hakket spinat | 750 | g | – | hakket spinat | REMA 750 g (R-FGR) | high (REMA) |
| Leaf spinach | Helbladet spinat | 450 | g | – | bladspinat | REMA 450 g (R-FGR) | high (REMA) |
| Green beans | Haricots verts | 600 | g | – | haricots verts | REMA 600 g (R-FGR) | high (REMA) |
| Edamame, shelled | Edamame bønner | 350 | g | – | edamame · [5024911](https://www.nemlig.com/produkt/5024911) | nemlig | high |
| Kale | Grønkål frost | 450 | g | – | grønkål | REMA 450 g (R-FGR) | high (REMA) |
| Cauliflower rice | Blomkålsris | 350 | g | – | blomkålsris | REMA 350 g (R-FGR) | high (REMA) |
| Pearl onions | Perleløg | 500 | g | – | perleløg | not researched | low |
| Parsley, frozen | Persille frost | 250 | g | – | persille frost · [5044351](https://www.nemlig.com/produkt/5044351) | nemlig Ardo | high |
| Raspberries | Hindbær frost | 200 | g | – | hindbær frost · [5070702](https://www.nemlig.com/produkt/5070702) | REMA 250 g (R-FGR) | high |
| Blueberries | Blåbær frost | 250 | g | – | blåbær frost | REMA 250 g (R-FGR) | high (REMA) |
| Strawberries | Jordbær frost | 400 | g | – | jordbær frost | REMA 400 g (R-FGR) | high (REMA) |
| Mixed berries | Bærmix | 200 | g | – | bærmix | REMA 200 g (R-FGR) | high (REMA) |
| French fries | Pommes frites | 1000 | g | – | pommes frites | REMA 1000 g; 600–750 g (R-FKA) | high (REMA) |
| Potato wedges | Kartoffelbåde | 600 | g | – | kartoffelbåde | REMA 600 g (R-FKA) | high (REMA) |
| Cod portions | Torskefilet u. skind | 400 | g | ~100 | torskefilet · [5602803](https://www.nemlig.com/produkt/5602803) (2 stk / 200 g [5068110](https://www.nemlig.com/produkt/5068110)) | nemlig | high |
| Salmon portions | Lakseportioner | 400 | g (4 stk) | 100 | lakseportioner · [5066476](https://www.nemlig.com/produkt/5066476) | REMA 400 g (R-FFI) | high |
| Prawns | Rejer (rå / kogte) | 200 | g | – | rejer | REMA 200 g (R-FFI) | high (REMA) |
| Fish fingers | Fiskepinde | – | – | – | fiskepinde | not researched | low |
| Puff pastry sheets | Butterdejsplader | 450 | g (6 plader) | 75 | butterdej · [807001](https://www.nemlig.com/produkt/807001) | nemlig | high |
| Chicken wings (hot wings) | Hotwings | 750 | g | – | hotwings | REMA 750 g (R-FKO) | med |
| Vanilla ice cream | Vaniljeis | 1 | l | – | vaniljeis | not researched | low |

### Other (baby/toddler, drinks used in cooking, chilled extras)

| English | Danish | Pack | Unit | Piece g | nemlig search · ID | Seen at | Conf |
|---|---|---|---|---|---|---|---|
| Baby oat porridge | Semper Havregrød mild | 480 | g | – | semper havregrød · [5050309](https://www.nemlig.com/produkt/5050309) | nemlig | high |
| Baby wholegrain porridge | Semper Fuldkornsgrød | 470 | g | – | fuldkornsgrød · [5050344](https://www.nemlig.com/produkt/5050344) | nemlig | high |
| Porridge pouch | Grød i klempose | 120 | g | 120 | grød klemmepose · [5016813](https://www.nemlig.com/produkt/5016813) | nemlig | high |
| Fruit pouch | Smoothie klempose | 90 | g | 90 | klemmepose · [5015937](https://www.nemlig.com/produkt/5015937) | nemlig | high |
| Meal pouch | Babymad klempose | 120 | g | 120 | babymad · [5601226](https://www.nemlig.com/produkt/5601226) | nemlig | high |
| Baby food jar | Babymos glas | 125 | g | – | babymos glas | no glass jars found on nemlig | low |
| Infant formula powder | BabySemp 1 | 800 | g | – | babysemp 1 · [5066936](https://www.nemlig.com/produkt/5066936) | nemlig | high |
| Infant formula, ready to drink | NAN Pro 1 | 6 | stk (200 ml) | 200 ml | nan pro 1 · [5033182](https://www.nemlig.com/produkt/5033182) | nemlig | high |
| Rice cakes | Riskiks | 100 | g | – | riskiks · [5049735](https://www.nemlig.com/produkt/5049735) | nemlig | high |
| Corn cakes | Majskiks | 130 | g | – | majskiks · [5007677](https://www.nemlig.com/produkt/5007677) | nemlig | high |
| Kids' yoghurt | Danonino | 4 | stk | 95 | danonino · [5026602](https://www.nemlig.com/produkt/5026602) | nemlig | high |
| Apple purée | Æblemos | – | – | – | æblemos | not researched | low |
| Hummus | Hummus | 200 | g | – | hummus | typical | low |
| White / red wine for cooking | Hvidvin / rødvin | 750 | ml | – | hvidvin | typical bottle | low |
| Dark beer / hvidtøl | Hvidtøl | 330 | ml | – | hvidtøl | typical bottle | low |

## Methodology: two web shops, one reference table, 507 recipes

The ingredient list came from parsing schema.org `recipeIngredient` data on 507 recipe pages. These came from valdemarsro.dk category pages (aftensmad, familiefavoritter, hverdagsfavoritter-smaa-boern, suppe, indisk, mexicansk, asiatisk, brød, morgenmad, kager and more), plus 16 classics fetched directly, 107 arla.dk recipes and 9 dk-kogebogen.dk classics. Spelling variants were merged by hand, and an item counted as "high" frequency when it appeared in at least 30 of the 482 main-batch recipes ([valdemarsro.dk](https://www.valdemarsro.dk/), [arla.dk](https://www.arla.dk/opskrifter/), [dk-kogebogen](https://www.dk-kogebogen.dk/opskrifter/33005/danske-frikadeller)). About 70 staples that recipe sites under-represent were added for coverage, not measured. These include pålæg, frozen convenience food, baby food, stegt flæsk and medister.

Pack sizes came from two shops. REMA 1000's web shop (shop.rema1000.dk) prints a pack line on every product in a category listing, such as "LØG: 1 KG.", so whole categories could be read at once (fetched 2026-11-20). nemlig.com category and search pages show only names and IDs, so pack sizes were read from individual product pages at `nemlig.com/produkt/<id>`, which print a size line such as "250 g / Arla Karolines Køkken". About 150 product pages were opened on 2026-11-20 and 2026-11-21. For dry goods, nemlig recipe pages (`nemlig.com/opskrifter/...`) were used, because their "Se varer" block names exact products and sizes. A few rows were confirmed through Open Food Facts, Tænk, Prisjagt and Bilka To Go search snippets. Piece weights came from the Mattilsynet 2015 Nordic table and from REMA's loose-sale ("vej selv") average weights. Where REMA and nemlig differed, the table gives nemlig's size, because orders will go to nemlig.

## Gaps: what the app must not trust yet

**Three of the five stores were not checked.** No product data was collected from Netto, Lidl Danmark or Meny. Their sites render only with JavaScript, there is no full readable online catalogue for Lidl DK or Netto, the Wolt Meny pages did not render, and web search returned Swedish, Norwegian or German results. The only exceptions are Meny's 1 kg oats in a Wolt search snippet ([Wolt Meny Haslev](https://wolt.com/en/dnk/haslev/venue/meny-haslev/items/kaffe-te-198)) and Salling (Netto's group) oats via Open Food Facts. Every "Seen at" value in the table is therefore REMA, nemlig or a third-party record. Netto and Lidl probably sell the same EU formats (400 g tins, 1 l milk, 200 g butter), but this is not verified.

**nemlig coverage is uneven.** Dairy, meat, spices, frozen and baby food were checked page by page. Dry goods were not: when that section was researched, nemlig's search API was blocked by the session's permission rules and its listing pages showed no sizes. As a result, almost every **dry-goods row except pasta, oats and wheat flour is a typical size, not a seen size**. The rows with the most uncertainty are vanilla sugar, baking powder, baking soda, dry yeast, cocoa, chocolate, honey, syrup, quinoa, risotto rice, noodles, nuts and seeds. Other low-confidence rows are tomato paste in tubes, light coconut milk, sweet chili, sriracha, hoisin, worcestershire, BBQ sauce, tahini, hummus, tinned lentils, white beans, quark, soy drink, tarteletter, baby glass jars, fresh pasta and cocktail sausages. Several nemlig IDs were seen but never opened, so their sizes are unknown: brown champignon, romaine, avocado, single garlic, chili, kohlrabi, Chinese cabbage, sweet potatoes, organic Brussels sprouts, bordsalt, white pepper, ground ginger, cayenne, whole cinnamon, cloves and soy drink. Search ranking on nemlig was never observed, so which product a search term returns first is unknown. That is another reason to store IDs.

**Tins carry two weights.** REMA's listed sizes for chickpeas (240 g) and kidney beans (252 g) are confirmed drained weights for 400 g net tins. For black beans (252 g), sweetcorn (285 g), pineapple (140 g), tuna (140 g), capers (60 g) and olives (140 g), the listed size is probably drained, and the net weights in the table (400, 340, 227 and 185 g) are inferred, not read. Whether REMA's 270 g asparagus is net or drained is unclear.

**nemlig sells several sizes under one name.** Examples are chicken breast (280 g to 1.2 kg), minced beef and minced pork (500 g and 1 kg, or 400 g and 1 kg), baking potatoes (1.5 and 2 kg), cinnamon (40 g jar and 210 g tub), oregano (15 g jar and 50 g bag) and four "Piskefløde 36%" SKUs. The pack size in the master table is only right for the linked ID. The nemlig default is sometimes much bigger than a recipe needs (2 kg potatoes, 500 g champignon, 1.2 kg pork tenderloin), and the app may prefer a smaller SKU on purpose.

**Season and weight gaps.** The research ran in November, so asparagus, rhubarb, strawberries, corn on the cob and fresh peas had no pack size. There is no sourced weight for hokkaido, butternut, savoy cabbage, romaine hearts or herb pots. Herbs at REMA are "1 STK", most likely potted plants, but cut herb sachets at nemlig or Meny were not checked. Asian herbs (lemongrass, kaffir lime leaves, galangal, Thai basil), marzipan, pine nuts, fish fingers, ice cream and apple purée were not looked up at all. Piece counts for burger buns (4), tortillas (8), grill sausages and frankfurters are inferences, not printed counts. The garlic clove weight is unresolved (2.5 g in MT against an unsourced planning value of 4–5 g). Piece weights rely on a Norwegian table, because the Danish DTU table could not be retrieved. Finally, the recipe sample leans towards baking and towards Valdemarsro's house style, while breakfast, pålæg and baby food are covered by added coverage rows rather than measured frequency.

## Conclusion

The data changes the design of the app's catalog more than its contents. A chain-wide "standard pack" does not exist: the same ingredient differs by a factor of two between REMA and nemlig (potatoes, carrots, champignon, crème fraîche, cooking cream). nemlig itself carries several sizes per name, so the catalog needs a **per-SKU record** for each item: nemlig ID, net amount, unit, drained amount if any, and piece weight. A generic pack size per ingredient is not enough. The sensible fallback order is a nemlig ID read from a product page, then REMA's printed size, then the typical size marked low, with the low rows queued for checking on nemlig's product pages.

The second implication is about leftovers rather than rounding. Recipe medians already line up with packs for mince, tins, coconut milk, pasta and potatoes. The waste sits in small-quantity, short-life items: cream in 0.25 l cartons, crème fraîche, herb pots, salad bags, and half-used cheeses. Carrying those leftovers into the next meal plan will save families more than any rounding rule. The fastest way to raise confidence is to open the remaining nemlig product pages for dry goods and the "(n.o.)" IDs. Checking Netto or Lidl matters less, because orders go to nemlig.
