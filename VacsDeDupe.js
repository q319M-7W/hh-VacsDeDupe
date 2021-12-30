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
	let v_list = doc.querySelectorAll('.vacancy-serp-item')
	let marks = ["vacancy-serp__vacancy-title", "vacancy-serp__vacancy-employer", "vacancy-serp__vacancy-address"] /* "vacancy-serp__vacancy_snippet_responsibility", "vacancy-serp__vacancy_snippet_requirement" */
	let list = []

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

	console.log(v_list.length)

	//список вакансий с маркерами
	{
		function get_data(mark_number, vac_block, type) {
			let t
			if (mark_number != 3) {
				t = vac_block.querySelector(`[data-qa=${marks[mark_number]}]`) //объект по метке
			} else if (mark_number == 3) {
				t = vac_block.querySelector(`[class="vacancy-serp-item__info"]`) //объект по метке
				// t = t.parentElement
				t = t.firstChild
				if (t == null) {

					console.log(vac_block)

				}
			}
			let res
			if (type == 'text') {
				res = t.innerText.toLowerCase().replace('ё', 'е').replace(/[^a-zа-я\d]+/g, ' ').trim()
			} else if (type == 'html') {
				res = t
			} else if (type == 'href') {
				res = t.pathname.match(/\d+/)[0]
			}
			return res
		}
		// let temp = ''
		for (let v of v_list) {
			// temp = v.querySelector(`[data-qa=${marks[0]}]`).innerText
			list.push({
				'vac_name': get_data(0, v, 'text'), 'vac_href': get_data(0, v, 'href'),
				'emp_href': get_data(1, v, 'href'), 'vac_city': get_data(2, v, 'html'), 'vac_desc': get_data(3, v, 'text')
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
		let vs = i.vac_name.replace('ё', 'е').toLowerCase() //упрощённое имя вакансии
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
			minList[i.emp_href][vs]['hide'][i.vac_href] = i.vac_city
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

	//обработка списка на странице
	for (let v of v_list) {
		//ссылка на текущую вакансию (название вакансии → ссылка → код ссылки)
		let vac_href_ = v.querySelector(`[data-qa=${marks[0]}]`).pathname.match(/\d+/)[0]

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
				let c2 = doc.createElement('div')
				c1.append(c2)
				c2.textContent = `*${vcs_count[vac_href_]}`
			}

			//выбор элемента текущего города
			let t = v.querySelector(`[data-qa=${marks[2]}]`)
			// console.log(t)
			//обход списка городов-дублей
			for (let h in f) {
				//получение элемента дубля
				let nc = f[h]
				let a = document.createElement('a')
				a.innerHTML = nc.innerHTML
				nc.innerHTML = ''
				a.setAttribute("href", `/vacancy/${h}`)
				nc.append(a)

				//console.log(f);console.log(`/vacancy/${h}`);console.log(nc);

				t.after(nc)
			}
		}
	}

	{
		doc.querySelector('style').innerHTML +=
			`
		/*число вакансий на странице*/
		:root{
			--c1: #3c9df2;
			--c2: #4bb24e;
		}
		/*блок счётчика*/
		.vacancy-serp-item__counter{
			vertical-align: bottom;
		}
		.vacancy-serp-item__counter > div{
			padding: 0 8px 0 0;
		}
		.vacancy-serp-item__counter > div > div{
			font-size: 32px;
			color: rgb(75, 178, 78);
			line-height: 1;
			border: #ebfaeb 4px dashed;
			border-radius: 10px;
		}
		`

		//число вакансий после фильтра

		let v_string = doc.querySelectorAll('.bloko-header-section-3')[0]
		// let v_count = Number(v_string.innerText.match(/\d+/)[0])
		let v_count = v_list.length //число вакансий на странице

		console.log('v_count'); console.log(v_count)

		//модификация строки
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
		let vac_href = v.querySelector(`[data-qa=${marks[0]}]`).pathname.match(/\d+/)[0]
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
