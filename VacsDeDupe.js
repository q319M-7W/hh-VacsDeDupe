// ==UserScript==
// @name         hh VacsDeDupe
// @namespace    http://tampermonkey.net
// @version      0.1
// @description  Скрывает дубликаты вакансий. Считает дубли. Указывает число дублей под каждой вакансией. Вставляет под городом основной вакансии города вакансий дублей со ссылками на саму вакансию дубль. Проверяет на дубль по идентичным словам в тексте.
// @author       NotYou
// @match        https://hh.ru/search/vacancy?*
// @icon         https://i.hh.ru/favicons/hh.ico
// @grant        none
// ==/UserScript==

'use strict';

function main() {

	let word = (e) => {
		e = e.toString(); let last_digit = e.substr(-1, 1), pre_last_digit = e.slice(-2, -1);
		return ((pre_last_digit == 1 || last_digit == 0 || last_digit >= 5 && last_digit <= 9) ? "дублей" : last_digit == 1 ? "дубль" : "дубля")
	}

	let doc = document
	let v_list_ = doc.querySelectorAll('.vacancy-serp-item')
	let v_list = [].slice.call(v_list_)

	// let marks = ["vacancy-serp__vacancy-title", "vacancy-serp__vacancy-employer", "vacancy-serp__vacancy-address"]
	let marks = {
		"data-qa": {
			"title": "vacancy-serp__vacancy-title", "employer": "vacancy-serp__vacancy-employer", "address": "vacancy-serp__vacancy-address",
			"date": "vacancy-serp__vacancy-date", "compensation": "vacancy-serp__vacancy-compensation", "description": "vacancy-serp__vacancy_snippet"
		},
		"class": { "response": "vacancy-serp-item__controls-item_response" }
	}
	/* "vacancy-serp__vacancy_snippet_responsibility", "vacancy-serp__vacancy_snippet_requirement" */
	let list = []

	//перебор и исключение из перебора вакансий со сложной рекламной ссылкой
	for (let i = 0; i < v_list.length; i++) {
		let vac_pathname = v_list[i].querySelector(`[data-qa=${marks["data-qa"]['title']}]`).pathname
		if (vac_pathname == "/click") { //если найдена плохая ссылка
			v_list.splice(i, 1) //то вакансия удаляется из массива
		}
	}

	/*
	list структура
	[
		{
			emp_href: код ссылки работодателя,
			vac_city: HTML элемент города,
			vac_desc: описание вакансии,
			vac_href: код ссылки главной вакансии,
			vac_name: имя вакансии
		},
		{...},
		...
	]
	*/

	console.log(v_list_.length)

	//список вакансий с маркерами
	{
		function get_data(mark, vac_block, type) {
			// let text = 'Денег нет, но вы.. err@RbuG_n_0tfoUnd/*ritlcaL'
			let t
			if (mark == "response") {
				t = vac_block.querySelector(`[class~=${marks['class'][mark]}]`).firstElementChild //объект по метке
			} else {
				if (mark == "description") {
					t = vac_block.querySelector(`[data-qa*=${marks['data-qa'][mark]}]`).parentElement //объект по метке
				} else {
					t = vac_block.querySelector(`[data-qa=${marks['data-qa'][mark]}]`) //объект по метке
					if (mark == 'compensation' && t == null) {
						return '~'
					}
				}
			}
			let res // извлечение содержимого
			if (type == 'text') { // текст пастеризованный
				res = t.innerText.toLowerCase().replace('ё', 'е').replace(/[^a-zа-я\d+#]+/g, ' ').trim()
			} else if (type == 'raw-text') { // сырой текст
				res = t.innerText.trim()
			} else if (type == 'html') { // HTML
				res = t
			} else if (type == 'href') { // код ссылки
				res = t.pathname.match(/\d+/)[0]
			}
			return res
		}
		for (let v of v_list) {
			list.push({
				'vac_name': get_data("title", v, 'text'), 'raw-vac_name': get_data("title", v, 'raw-text'), 'vac_href': get_data("title", v, 'href'),
				'emp_href': get_data("employer", v, 'href'), 'address': get_data("address", v, 'html'), 'description': get_data("description", v, 'raw-text'),
				'response': get_data("response", v, 'raw-text'), 'compensation': get_data("compensation", v, 'raw-text'), 'date': get_data("date", v, 'raw-text')
			})
		}
	}

	console.log('list'); console.log(list)

	let hideList = [] //вакансии дубли, список для скрытия
	/*
	hideList структура
	[
		код ссылки скрываемой вакансии,
		...
	]
	*/
	let minList = {} //структурированный лист, по компаниям
	//автоматическая фильтрация вакансий по словам текста в их оригинальном порядке
	/*
	minList структура
	{
		код ссылки работодателя: {
			имя вакансии: {
				main: код ссылки главной вакансии,
				hide: {
					код ссылки скрываемой вакансии: HTML элемент города,
					..:..,
					...
				}
			}
		}
	}
	 */
	//перебор списка вакансий
	for (let i of list) {
		let vs = i.vac_name //упрощённое имя вакансии
		// console.log(i)
		if (minList[i.emp_href] == undefined) {
			minList[i.emp_href] = {}
		}
		if (minList[i.emp_href][vs] == undefined) {
			minList[i.emp_href][vs] = { 'main': i.vac_href }
		} else {
			if (minList[i.emp_href][vs]['hide'] == undefined) {
				minList[i.emp_href][vs]['hide'] = {}
			}
			minList[i.emp_href][vs]['hide'][i.vac_href] = {
				'address': i['address'], 'response': i['response'], 'description': i['description'], 'date': i['date'],
				'compensation': i['compensation'], 'vac_name': i['vac_name'], 'raw-vac_name': i['raw-vac_name']
			}
			hideList.push(i.vac_href)
		}
	}

	console.log('minList'); console.log(minList)
	console.log('hideList'); console.log(hideList)

	let finList = {} //финальный список
	/*
	finList структура
	{
		код ссылки главной вакансии: {
			код ссылки скрываемой вакансии: HTML элемент города,
			..:..,
			...
		}
	}
	*/
	for (let v in minList) {
		for (let o in minList[v]) {
			// console.log(minList[v][o])
			let t = minList[v][o]
			finList[t['main']] = t['hide'] //список скрытия в главной вакансии
		}
	}

	console.log('finList'); console.log(finList)

	let vcs_count = {} // блок количества вакансий
	/*
	vcs_count структура
	{
		код ссылки главной вакансии: количество скрытых вакансий дублей
	}
	*/

	for (const main_vac of Object.keys(finList)) {
		if (finList[main_vac] != undefined) {
			let n = Object.keys(finList[main_vac]).length
			vcs_count[main_vac] = n
		}
	}

	console.log('vcs_count'); console.log(vcs_count)
	doc.querySelector('style').innerHTML +=
		`
		/*число вакансий на странице*/
		:root {
			--c1: #3c9df2;
			--c2: #4bb24e;
			--c10: #ebfaeb;
			--c11: #fef8e5;
		}

		.show-block {
			display: unset;
			top: 0px;
			left: 0px;
			max-width: 360px !important;
		}

		/*блок счётчика*/
		.vacancy-serp-item__counter {
			vertical-align: bottom;
		}

		/*
			.vacancy-serp-item__counter > div{
				padding: 0 8px 0 0;
			}
			*/
		.vacancy-serp-item__counter>div {
			font-size: 32px;
			color: rgb(75, 178, 78);
			line-height: 1;
			border: #ebfaeb 4px dashed;
			border-radius: 10px;
			padding: 1px;
		}

		.pb-0::before {
			content: '.';
			color: transparent;
		}

		.pb-1::before {
			content: '.';
			color: transparent;
		}

		.pb-2::before {
			content: '!';
		}

		.pb-3::before {
			content: '⨯'; //⨉
		}

		.pseudo-button {
			height: auto !important;
			line-height: normal !important;
			padding: 0 2px !important;
			width: 14px !important;
			text-align: center !important;
			border-color: transparent !important;
			color: #fff !important;
			/* align-content: center !important; */
			/* align-items: center !important; */
			/* align-self: center !important; */
			/* justify-content: center !important; */
			/* justify-items: center !important; */
			/* justify-self: center !important; */
			display: inline-table !important;
			margin-right: 2px;
			border-radius: 4px;
			vertical-align: middle;
			box-sizing: border-box;
			font-size: 14px;
		}

		.pb-0 {
			background-color: #1785e5 !important;
		}

		.pb-1 {
			background-color: #4bb24e !important;
		}

		.pb-2 {
			background-color: #4bb24e !important;
		}

		.pb-3 {
			background-color: #d92121 !important;
		}

		@keyframes kf-color-mix {
			0% {
				color: var(--c10)
			}

			100% {
				color: var(--c11)
			}
		}

		div.show-block>div:nth-child(1)>br {
			line-height: .8em !important;
		}

		div.show-block>div:nth-child(1)>p>span:nth-child(1) {
			font-family: "Courier New";
			font-size: 12px;
			margin-right: 4px;
			color: #849361;
			/* color: var(--c10); */
			/* color: var(--c11); */
			/* animation: kf-color-mix 1s -.5s linear forwards paused; */
			/* animation: kf-color-mix 1s -.85s linear forwards paused; */
			/* filter: brightness(40%) contrast(100%) saturate(200%); */
		}

		.err_place {
			color: gray;
			font-size: .8em;
		}
		`

	let strange_block = (compensation, title, description, date, response) => {
		let div_0 = doc.createElement('div')
		div_0.classList.add("bloko-drop", "bloko-drop_tip", "bloko-drop_layer-overlay", "bloko-drop_top", "bloko-drop_theme-dark", "show-block", "hide-block")
		Object.assign(div_0, { "style": "" })
		let br_ = () => doc.createElement('br')
		let div_0_0 = doc.createElement('div')
		let p0 = doc.createElement('p')
		if (compensation == '~') {
			let text_zero = 'Денег нет, но вы.. '
			p0.innerText = text_zero
			let span0_ = doc.createElement('span')
			span0_.classList.add('err_place')
			// span0_.innerText = ''
			p0.append(span0_)
		} else {
			p0.innerText = compensation
		}
		div_0_0.append(p0)
		div_0_0.append(br_())
		let span0 = doc.createElement('span')
		span0.innerText = 'pay:'
		p0.prepend(span0)
		let p1 = doc.createElement('p')
		p1.innerText = title
		div_0_0.append(p1)
		div_0_0.append(br_())
		let span1 = doc.createElement('span')
		span1.innerText = 'name:'
		p1.prepend(span1)
		let p2 = doc.createElement('p')
		p2.innerText = description
		div_0_0.append(p2)
		div_0_0.append(br_())
		let span2 = doc.createElement('span')
		span2.innerText = 'description:'
		p2.prepend(span2)
		let p3 = doc.createElement('p')
		p3.innerText = date
		div_0_0.append(p3)
		div_0_0.append(br_())
		let span3 = doc.createElement('span')
		span3.innerText = 'date:'
		p3.prepend(span3)
		let p4 = doc.createElement('p')
		p4.innerText = response
		div_0_0.append(p4)
		div_0_0.append(br_())
		div_0.append(div_0_0)
		let span4 = doc.createElement('span')
		span4.innerText = 'response:'
		p4.prepend(span4)
		// Object.assign(div_0_0, {"data-qa":"bloko-drop-tip"})
		let div_0_1 = doc.createElement('div')
		div_0_1.classList.add("bloko-drop__arrow")
		div_0.append(div_0_1)
		return div_0
	}

	let resp_list = {
		"откликнуться": 0, "вы откликнулись": 1, "вы приглашены": 2, "вам отказали": 3
	}

	function err_generator() {
		let text_error = ' error bug notFound critical'
		let new_string = text_error.split('')
		let length_of_error_string = text_error.length
		let percent_range = [30, 60]
		let range_min = percent_range[0] * length_of_error_string / 100
		let range_max = percent_range[1] * length_of_error_string / 100
		let problems_count = Math.ceil(range_min + Math.random() * (range_max - range_min))
		let possibility_map = new_string.map(x => Math.random())
		let sorted = possibility_map.slice().sort((a, b) => b - a).slice(0, problems_count)
		let index_map = sorted.map(
			(x) => {
				return possibility_map.findIndex(
					(y) => { return y == x }
				)
			}
		)
		console.log(length_of_error_string)
		console.log(index_map)
		/* function randInt() { return Math.round(Math.random()) } */
		function random_range(l) {
			return Math.floor((l - 1) * Math.random() + .5)
		}
		function change_oa(ch) {
			if (Math.random() > .5) {
				let s = '0@'
				return s.split('')[random_range(s.length)]
			} else {
				let temp_ch = ch.toLocaleLowerCase()
				if (temp_ch == 'o') {
					return 'a'
				} else {
					return 'o'
				}
			}
		}
		function rand_symb(empty = '') {
			let s = '@#$%^&*()_+|\/!;:-`~=.,'
			let res_s = ''
			let c = random_range(3)
			for (let i = 0; i < c; i++) {
				res_s += s.split('')[random_range(s.length)]
			}
			return res_s
		}
		function change_il(ch) {
			if (Math.random() > .5) {
				let s = '1|\/!:;'
				return s.split('')[random_range(s.length)]
			} else {
				let temp_ch = ch.toLocaleLowerCase()
				if (temp_ch == 'i') {
					return 'l'
				} else {
					return 'i'
				}
			}
		}
		function swapCase(ch) {
			// E → e // y → Y
			if (ch == ch.toLowerCase()) {
				return ch.toUpperCase()
			} else {
				return ch.toLowerCase()
			}
		}

		let funcs = [rand_symb, swapCase]
		for (const index of index_map) {
			let ch = new_string[index]
			let current_funcs = funcs.slice(0)
			let temp_ch = ch.toLocaleLowerCase()
			let res_ch = ''
			if (temp_ch == 'i' || temp_ch == 'l') {
				current_funcs.push(change_il)
				res_ch = current_funcs[random_range(current_funcs.length)](ch)
			} else if (temp_ch == 'o' || temp_ch == 'a') {
				current_funcs.push(change_oa)
				res_ch = current_funcs[random_range(current_funcs.length)](ch)
			} else {
				res_ch = current_funcs[random_range(current_funcs.length)](ch)
			}
			new_string[index] = res_ch
		}
		return new_string.join('')
	}

	//обработка списка на странице
	let delay = 10
	for (let v of v_list) {
		//ссылка на текущую вакансию (название вакансии → ссылка → код ссылки)
		let vac_href_ = v.querySelector(`[data-qa=${marks["data-qa"]['title']}]`).pathname.match(/\d+/)[0]

		//список дублей
		let f = finList[vac_href_]
		//если не пуст
		if (f != null) {

			{
				let labels_block = v.querySelector('.vacancy-serp-item__row_labels')
				let count_block = doc.createElement('div')
				count_block.classList.add('vacancy-serp-item__label', 'vacancy-serp-item__counter')
				labels_block.prepend(count_block)
				let c1 = doc.createElement('div')
				count_block.append(c1)
				// let c2 = doc.createElement('div')
				// c1.append(c2)
				c1.textContent = `*${vcs_count[vac_href_]}`
				// c2.textContent = `*${vcs_count[vac_href_]}`
			}

			//выбор элемента текущего города
			let t = v.querySelector(`[data-qa=${marks["data-qa"]['address']}]`)
			// console.log(t)
			//обход списка городов-дублей
			for (let h in f) {
				//получение элемента дубля
				let el = f[h]
				let el1 = el['address']
				let a1 = document.createElement('a')
				a1.innerHTML = el1.innerHTML
				el1.innerHTML = ''
				a1.setAttribute("href", `/vacancy/${h}`)
				el1.append(a1)
				//console.log(f);console.log(`/vacancy/${h}`);console.log(nc);
				t.parentElement.append(el1) //вставка города со ссылкой

				//блок состояния отклика перед городом
				let a2 = document.createElement('a')
				let el2 = el['response']
				a2.classList.add("pseudo-button", `pb-${resp_list[el2.toLowerCase()]}`) //"bloko-button"
				//console.log(f);console.log(`/vacancy/${h}`);console.log(nc);
				el1.prepend(a2) //вставка города со ссылкой

				let dark = strange_block(el['compensation'], el['raw-vac_name'], el['description'], el['date'], el['response'])
				a2.after(dark)
				let a2_height = a2.offsetHeight
				let a2_left = a2.offsetLeft
				let a2_top = a2.offsetTop
				let a2_width = a2.offsetWidth
				let dark_height = dark.offsetHeight //.getBoundingClientRect().height
				let dark_width = dark.offsetWidth //.getBoundingClientRect().width
				console.log(`a2_height = ${a2_height}\na2_left = ${a2_left}\na2_top = ${a2_top}\na2_width = ${a2_width}\ndark_height = ${dark_height}\ndark_width = ${dark_width}`)
				let delta_height = - dark_height + a2_top - a2_height
				// let delta_width = - dark_width / 2 + a2_left + a2_width / 2
				let delta_width = a2_left + a2_width / 2
				console.log(`delta_width = ${delta_width}\ndelta_height = ${delta_height}`)
				// dark.style = `top: ${delta_height}px; left: ${delta_width}px`
				dark.style = `top: ${delta_height}px;`
				dark.querySelector('.bloko-drop__arrow').style = `left: ${delta_width}px;`
				// dark.style =
				a2.addEventListener("mouseover", function () {
					setTimeout(() => {
						dark.classList.toggle('hide-block');
						dark.querySelector('.err_place').innerText = err_generator()
					}, 0)
				});
				a2.onmouseout = function () {
					setTimeout(() => {
						dark.classList.toggle('hide-block');
						dark.querySelector('.err_place').innerText = ''
					}, delay)
				};
			}
		}
	}
	doc.querySelector('style').innerHTML +=
		`
		.hide-block{
			display: none !important;
		}
		`

	{	//число вакансий после фильтра

		let v_string = doc.querySelectorAll('.bloko-header-section-3')[0]
		// let v_count = Number(v_string.innerText.match(/\d+/)[0])
		let v_count = v_list_.length //число вакансий на странице

		console.log('v_count'); console.log(v_count)

		//модификация строки (верхней, с количеством вакансий)
		let text_string = [['span', ` // `, "color: #959799;"], ['span', `на странице: `, "color: var(--c1);"],
		['span', `${v_count} → ${v_count - hideList.length}`,
			"background-image: linear-gradient(to right, var(--c1), var(--c2)); background-clip: text; color: transparent;"],
		['span', ` (${hideList.length} ${word(hideList.length)})`, "color: var(--c2);"]]
		let write_string = (arr) => { //tag_name, text, style
			arr.forEach(element => {
				let el = document.createElement(element[0]) //тэг
				el.innerText = element[1] //текст
				el.style = element[2] //стиль
				v_string.append(el)
			});
		}
		write_string(text_string)
	}

	//скрытие вакансий
	for (let v of v_list) {
		//ссылка на текущую вакансию
		let vac_href = v.querySelector(`[data-qa=${marks["data-qa"]['title']}]`).pathname.match(/\d+/)[0]
		if (hideList.includes(vac_href)) {
			v.style = "display: none"
			hideList.splice(hideList.indexOf(vac_href), 1)
		}
	}

};

//иногда не запускает
document.addEventListener('readystatechange', () => {
	if (document.readyState == 'complete') {
		setTimeout(() => {
			main()
			console.log()
		}
			, 500
		)
	}
});
