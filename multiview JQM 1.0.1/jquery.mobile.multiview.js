/*
 * jQuery Mobile Framework : "panelview" plugin
 * Copyright (c) Sven Franck
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * Version 18.03.2012
 */

(function ($, window) {

    $.widget("mobile.multiview", $.mobile.widget, {
        options: {

            switchable: false,
            switchableHideOnLoad: false,

            menuTxt: 'Menu',
            menuBtnTheme: 'a',
            menuBtnIcon: 'gear',
            menuBtnIconPos: 'left',
            menuWidth: '25%',
            menuMinWidth: '250px',

            // deeplink sitemap
            externalSiteMap: [
                ["#info", "info.html", "contact_popover2"]
            ],

            // mimic JQM $ignoreNextHashChange
            $ignoreMyOwnNextHashChange: false,

            // make hashChange backward transitions sure to pass ignoreMyOwnNextHashChange
            $hashJoker: 0,

            // need this if pagination plugin is used
            $blockPaginationHashChange: false,

            // remember stack length at init
            $jqmHistoryStackAtInit: '',

            // store click events
            $stageEvent: null,

            // 
            $infinity: '',

            // block hashChanges originating from crumbs back-button
            $crumbsBlockStackUp: false,

            // block scrollTop on transitions inside a popover
            $panelTransBlockScrollTop: '',

            // keep up with window.history
            $windowHistoryCounter: 0,

            // block 2nd hashchange on context transitions
            $contextBlockNextHashChange: '',

            // block popover panel closing on a context transition
            $blockContextScrollTop: '',

            // splitview/popover threshold width
            $thresh: 768,

            // Android multi-click-prevent
            $blockMultiClick: false

        },

        _create: function () {

            var self = this,
                baseClasses = $.support.touch ? 'touch multiview ui-plain-mode' : 'multiview ui-plain-mode',
                hist;

            // set base
            $('html').addClass(baseClasses).data({
                'backAtBase': true
            });

            // store JQM stack height as fallback
            self.options.$jqmHistoryStackAtInit = $('div:jqmData(wrapper="true")').jqmData('external-page') == true ? $.mobile.urlHistory.stack.length : 1;

            // init panel-history for each panel - function makes no sense but works! 			
            $(document).on('pagecreate', 'div:jqmData(hash="history")', function () {

                hist = $(this);

                // this should only fire if history is off or undefined. If you start from a multiview page, all data-hash="history" panels' stacks are initiated
                // they stay active until the page is dropped from the DOM. If you go back, then they are re-initiated again.
                // if the respective page is the first page in the DOM, the history simply stays active, so "going" to another page and coming back does not 
                // trigger a history-stack re-initialization									
                if (hist.data("history") == "off" || typeof hist.data("history") == 'undefined') {
                    hist.data("history", "on");
                    hist.data("stack", []);
                    hist.data("stack").push('#' + hist.find('div:jqmData(show="first")').attr('id'));
                }

            });

            // global bindings					
            self._popoverBindings();
            self._mainEventBindings();

        },

        setupMultiview: function (event, page) {

            var self = this,
                $globalHeadewr, $globalFooter;

            page
            // add active-page before JQM does it, so plugin computing works
            .addClass($.mobile.activePageClass)

            // add viewport
            .find("div:jqmData(role='panel')").addClass('ui-mobile-viewport ui-panel').end()

            // set default panel history
            .find("div:jqmData(hash='history')").data("history", "off").end()

            // needed here (popovers, main/menu will be done by splitview setup)
            .find("div:jqmData(panel='fullwidth')").addClass('ui-panel-active').end()

            // add enhancement flag to popovers on page 
            .find("div:jqmData(panel='popover')").addClass("popEnhance").attr({
                'set': 'off'
            }).end()

            // also on menu in popover-mode
            .closest('html.ui-popover-mode').find('div:jqmData(panel="menu")').addClass("popEnhance").attr({
                'set': 'off'
            }).end()

            // add internal page status to all nested pages to enable panel-cache
            .find("div:jqmData(role='page')").attr('data-internal-page', 'true').end()

            // assign data-url by hand for pages pulled in externally
            // TODO: not nice, creates problems, when pages are pulled in which includes nested pages.
            .filter(':jqmData(external="true")').find('div:jqmData(role="page")').each(function () {
                $(this).attr('data-url', $(this).attr('id'));
            }).end()

            // enhance first pages on all panels
            .find('div:jqmData(role="panel") > div:jqmData(show="first")').addClass($.mobile.activePageClass).trigger('create');

            // init popovers on wrapper page
            self._setupPopovers(page);

            // global header/footer classes and padding
            if (page.find('div:jqmData(role="panel")').length > 0) {
                $globalHeader = page.children('div:jqmData(role="header")').addClass('ui-header-global'), $globalFooter = page.children('div:jqmData(role="footer")').addClass('ui-footer-global');
            }

            // if panels, fire splitscreen
            if (page.find("div:jqmData(panel='main'), div:jqmData(panel='menu'), div:jqmData(panel='fullwidth')").length > 0) {
                self.splitScreen("init");
            }

            // fire display mode set and page "make-up"
            self.gulliver();
            self.checkWidth();
            self.panelHeight();

        },

        // popover panels setup
        _setupPopovers: function (page) {

            var self = this,
                show, pop;

            page.find(".popEnhance").each(function (i) {

                pop = $(this);
                pop.attr({
                    'status': 'hidden'
                });

                if (pop.attr('set') == 'off') {

                    // flag
                    pop.jqmData('set', 'ok');

                    // triangles
                    if (pop.hasClass('ui-triangle-bottom')) {
                        pop.append('<div class="popover_triangle" />');
                    } else if (pop.hasClass('ui-triangle-top')) {
                        pop.prepend('<div class="popover_triangle" />');
                    }

                    // autoshow
                    if (pop.jqmData("autoshow") == "once") {
                        show = pop.jqmData('id');

                        // show panel
                        window.setTimeout(function () {
                            page.find(".toggle_popover:jqmData(panel='" + show + "'):eq(0)").click();
                        }, 10);

                        // remove autoshow from DOM!
                        pop.jqmRemoveData("autoshow").removeAttr('data-autoshow');
                    }
                }
            });

        },

        // popover panels toggle routine
        _popoverBindings: function () {

            var self = this;

            // (1) toggle button
            $(document).on('click', 'a.closePanel', function () {
                hideAllPanels("#1");
            });

            // (2) scrollStart on panels
            $(document).on('scrollstart', 'div.ui-page-active div:jqmData(panel="main"), div.ui-page-active div:jqmData(panel="fullwidth")', function () {
                // prevent iOS keyboard hiding popover				
                if (!$("input:focus").length > 0) {
                    hideAllPanels("#2");
                }

            });

            // (3) scrollStart on document
            $(document).on('scroll', function () {
                // only hide if not in fullscreen mode, no blocker has been set (necessary 
                // if new pages are appended to DOM - can't find scrollTop 
                // to block) or if this is a "scrollTop" initiated from a context transition 
                // (need to keep the initiating popover active)													
                if (!$('html').hasClass('ui-fullscreen-mode') && self.options.$panelTransBlockScrollTop == false && !self.options.$blockContextScrollTop == true) {
                    // prevent iOS keyboard hiding popover						
                    if (!$("input:focus").length > 0) {
                        hideAllPanels("#3");
                    }
                    // reset for next;
                    self.options.$panelTransBlockScrollTop == true;
                }
                self.options.$blockContextScrollTop = '';
            });


            // (4) click or tap the wrapper, not the popover
            $(document).on('click tap', 'div:jqmData(wrapper="true").not(".toggle_popover")', function (event) {
                if ($(event.target).parentsUntil(this, '.ui-popover').andSelf().length && !$(event.target).parentsUntil(this, '.toggle_popover').length) return;
                hideAllPanels("#4");
            });

            // (5) changePage on main or fullwidth panel
            $(document).on('pagebeforehide', 'div.ui-page-active div:jqmData(panel="main") div.ui-page-active, div.ui-page-active div:jqmData(panel="fullwidth") div.ui-page-active', function (event) {
                // not if this is because of a context transition							
                if (self.options.$contextBlockNextHashChange == false) {
                    hideAllPanels("#5");
                }
            });

            // (6) click of a link on a panel, which loads a page on another panel
            $(document).on('click', 'div:jqmData(role="panel") a', function () {
                if ($('html').hasClass('ui-fullscreen-mode') && $(this).jqmData('panel') != $(this).closest('div:jqmData(role="panel")').jqmData('id')) {
                    hideAllPanels("#6");
                }
            });

            // (7) on orientationchange
            // breaks deeplinks, no clue why
            // $(window).on('orientationchange', function(event){ 
            // 		hideAllPanels("#7");
            // 		});			 
            // (7) hide when leaving a wrapper page
            $(document).on('pagehide', 'div:jqmData(role="page").basePage', function () {
                hideAllPanels("#7");
            });

            // hidePanels
            function hideAllPanels(from) {

                // clear button
                $('.toggle_popover').removeClass('ui-btn-active');

                // panel loop
                $("div:jqmData(panel='popover'), .ui-popover-mode div:jqmData(panel='menu')").each(function (index) {

                    var pop = $(this);

                    if (pop.attr('status') == 'visible') {
                        // hide
                        pop.attr('status', 'hidden')
                        // pop transition
                        .addClass('reverse out').hide('fast')
                        // clean up active classes
                        .removeClass('ui-panel-active').find(".ui-page-active").not("div:jqmData(show='first')").removeClass('ui-page-active').end().find(".ui-btn-active").removeClass('ui-btn-active');

                        // fullscreen handler
                        if ($('html').hasClass('ui-fullscreen-mode')) {

                            //reactivate background panels
                            $('.ui-panel-hidden').removeClass('ui-panel-hidden');

                            //reactivate background pages							
                            $('.reActivate').addClass('ui-page-active').removeClass('reActivate');

                            // reset background page height
                            self.backPageHeight('', "clear")
                        }

                        // clear history
                        self.historyDump(pop)

                        // drop pages pulled into the panel from DOM										
                        pop.find('div:jqmData(external-page="true")').remove();

                        // clean up bleed-through Android clicks
                        $('.androidSucks').removeClass('ui-disabled androidSucks').removeAttr('disabled');

                        // clean up url and remove last visited page on panel from URL
                        // ipad errors "type of expression" undefined if I have not done a transition, so
                        // I'm also checking for base						
                        var rem = $('html').data("rememberState");

                        if (rem.length > 0 && typeof rem != 'undefined' && $('html').data('backAtBase') != true) {
                            history.replaceState('null', rem.title, rem.url);
                        }

                    } else {
                        // make sure panel is gone... not sure why status sometimes is hidden with panels visible when navigating between wrapper pages
                        pop.css('display', 'none').attr('status', 'hidden');
                    }
                });
                // clean up pop() transition 
                window.setTimeout(function () {
                    $('div:jqmData(role="panel")').removeClass('reverse out pop');
                }, 350);

            }

            // show panel routine
            $(document).on('click', 'a.toggle_popover', function (event) {

                var $correspond = $(this).jqmData("panel"),
                    $switch = $('.ui-splitview-mode div:jqmData(panel="menu")'),
                    $popPanel = $('div:jqmData(id="' + $correspond + '")');

                if ($popPanel.attr('status') == 'visible') {

                    // if there is a menu with class switchable and it's visible and the toggle-button for this menu was clicked
                    if ($switch && $switch.hasClass('switchable') && $switch.jqmData('id') == $correspond) {
                        // run switchable							
                        $switch.css('display', 'none').attr('status', 'hidden').addClass("switched-hide");
                        self.checkWidth();
                    } else {
                        // regular panel routine
                        // (8) clicking on active popover button closes this popover agin
                        hideAllPanels("#8");
                    }

                } else {

                    // show switch						
                    if ($switch && $switch.hasClass('switchable') && $switch.jqmData('id') == $correspond) {
                        $switch.attr('status', 'visible').css('display', 'block').removeClass("switched-hide");
                        // update layout
                        self.checkWidth();
                    } else {

                        // regular panel routine
                        // (9) clicking on a not-active trigger button closes all other popovers first
                        hideAllPanels("#9");

                        // calculate center position if trigger-class is provided
                        if ($popPanel.hasClass('ui-popover-center')) {
                            $popPanel.css("left", (($(window).width() - $popPanel.outerWidth()) / 2) + $(window).scrollLeft() + "px");
                        }

                        // show popover
                        $popPanel.not('.ui-splitview-mode div:jqmData(panel="menu")').attr('status', 'visible')
                        // pop() transition
                        .addClass('ui-panel-active pop in').show('fast').find('div:jqmData(show="first")').addClass('ui-page-active');

                        // clean up pop transition
                        window.setTimeout(function () {
                            $popPanel.removeClass('in');
                        }, 350);

                        // remembers url for history.replaceState() once panel closes again
                        var $myState = {};
                        $myState.title = document.title;
                        $myState.url = location.href;
                        //$myState.url = $.mobile.path.stripHash( location.href );
                        $('html').data("rememberState", $myState);

                        // fullscreen handler	
                        if ($('html').hasClass('ui-fullscreen-mode')) {
                            // hide background panel, so popover does not drop below it							
                            $('div:jqmData(panel="main").ui-panel-active, div:jqmData(panel="fullwidth").ui-panel-active').addClass('ui-panel-hidden');

                            //remove all other active pages to make sure popover is visible $popPanel.find('.ui-page-active')	
                            //assign a reActivate flag to activate pages again once this panel hides
                            $('.ui-page-active').not("div:jqmData(wrapper='true'), div:jqmData(id='" + $correspond + "') .ui-page-active").addClass("reActivate").removeClass('ui-page-active')

                            // "fix" for Android bleeding through clicks... requires to disable background page buttons and 
                            // inputs/selects while navigating overlay pages, otherwise click goes through to background page
                            // http://code.google.com/p/android/issues/detail?id=6721	
                            $('.ui-page').not($popPanel.find('.ui-page-active')).find(".ui-header").first().find(".ui-btn, input, select, textarea").addClass('ui-disabled androidSucks').attr('disabled', 'disabled')


                            // get active or data-show first page on the panel
                            var activePage = $popPanel.find('.ui-page-active'),
                                firstPage = $popPanel.find('div:jqmData(show="first")'),
                                refPage = activePage.length > 0 ? activePage : firstPage;

                            // tweak background page height	to enable natural scrolling
                            self.backPageHeight(refPage, "set")
                        }

                        $(this).addClass('ui-btn-active');
                    }
                }
            });

        },

        // back button handling on panel pages
        crumble: function (event, data, page) {

            // /*
            var self = this;

            var $prevPage, onPage = $('#' + page.attr('id')),
                $crumPanel = $('#' + page.attr('id')).closest('div:jqmData(role="panel")'),

                // check if local or global header
                $header = onPage.find('div:jqmData(role="header")').length != 0 ? onPage.find('div:jqmData(role="header")') : onPage.closest('div:jqmData(wrapper="true").ui-page-active').children('div:jqmData(role="header")'),

                // what's left?
                $first = $header.find('.ui-btn-left').children(':first'),

                // if it's a button, grab it. if it's a button wrapper, grab it's first child
                $leftBtn = $header.find('.ui-btn-left.ui-btn').length ? $header.find('.ui-btn-left.ui-btn') : $first.hasClass('ui-controlgroup') ? $first.children(':not(.ui-crumbs)').first() : $first,

                $backUp = $crumPanel.data("stack").length;

            // set button href - go back through the respective stack until first
            // entry not yield or onPage = current page is found
            for (i = $backUp - 1; i >= 0; i--) {

                if ($crumPanel.data("stack")[i] != "yield" && $crumPanel.data("stack")[i] != '#' + onPage.attr('id')) {
                    var $prevPage = $crumPanel.data("stack")[i];
                    break;
                }
            }

            // TODO: separate this into data-hash="crumbs" and data-hasn="history"?
            if ($crumPanel.data('hash') == 'history') {

                // if panel stack is > 1 it has a history, add button, unless it's the first page of panel
                if ($backUp > 0 && onPage.jqmData("show") != "first") {

                    var prevPageTitle = $($prevPage).find('div:jqmData(role="header") .ui-title'),
                        prevText = prevPageTitle.length ? prevPageTitle.html() : $prevPage

                        crumbify($leftBtn, $prevPage, prevText, onPage, $header);
                }
            }

            function crumbify(button, href, text, page, header) {

                var panelID = $('#' + page.attr('id')).closest('div:jqmData(role="panel")').jqmData("id"),
                    $theme = header.jqmData('theme'),
                    polish, controlgroup, newButton = $("<a href='" + href + "' class='ui-crumbs iconposSwitcher-a' title='back' data-panel='" + panelID + "'>" + text + "</a>").buttonMarkup({
                        shadow: true,
                        corners: true,
                        theme: $theme,
                        iconpos: "left",
                        icon: 'arrow-l'
                    })

                    if (button.length == 0) {
                        // no button = insert newButton
                        header.prepend(newButton.addClass('ui-btn-left'))

                    } else if (button && button.hasClass('ui-crumbs') == true) {

                        // previous button = replace with new button
                        button.replaceWith(newButton.addClass('ui-btn-left'));

                    } else {
                        // previous controlgroup = replace with new controlgroup
                        // first button not ui-crumbs from this controlgroup will be ported into new controlgroup
                        // this works with button, selects, forms?
                        newButton.addClass('ui-corner-left').removeClass('ui-btn-corner-all').find('span.ui-btn-inner').addClass('ui-corner-left').removeClass('ui-corner-top ui-corner-bottom')

                        polish = button.hasClass('ui-btn') ? button : button.find('.ui-btn');

                        polish.addClass('ui-corner-right').removeClass('ui-corner-top ui-corner-bottom ui-btn-corner-all').find('span.ui-btn-inner').addClass('ui-corner-right').removeClass('ui-corner-top ui-corner-bottom')

                        controlgroup = $(document.createElement("div")).attr({
                            'data-role': 'controlgroup',
                            'data-type': 'horizontal'
                        }).append(newButton.add(button)).controlgroup();

                        page.find('div.headWrapLeft div.ui-controlgroup').replaceWith(controlgroup)


                    }
            }
            // */
        },

        replaceBackBtn: function () {
            // /*
            var self = this;

            // TODO: this is not very flexible, improve
            // run through all links in menu with data-panel specified and replace the menu button with the previous button
            $('div:jqmData(panel="main") div:jqmData(role="page")').each(function (index) {

                var $header = $(this).find("div:jqmData(role='header')"),
                    $btn, $oldButton;

                // check if a button was stored on this page = this will now be a controlgroup
                if ($(this).jqmData('storeBtn')) {
                    // button stored, replace with button
                    $btn = $(this).data("storeBtn");
                    $oldButton = '<a class="ui-crumbs ui-btn-left ui-btn ui-btn-icon-left ui-btn-corner-all ui-shadow ui-btn-up-a" data-icon="' + $btn.buttonIcon + '" data-role="button" href="' + $btn.buttonTarget + '" data-panel="' + $btn.buttonTarget + '" data-theme="a"><span class="ui-btn-inner ui-btn-corner-all" aria-hidden="true"><span class="ui-btn-text">' + $btn.buttonText + '</span><span class="ui-icon ui-icon-arrow-l ui-icon-shadow"></span></span></a>'
                    $header.children('.mergedButtons').replaceWith($oldButton);
                } else {
                    // no button, just remove menu toggle button
                    $header.children('.menuToggle').remove();
                }

            });
            // */
        },

        popover: function () {
            // /*			
            var self = this,
                $menu = $('div:jqmData(id="menu")'),
                $main = $('div:jqmData(id="main")'),
                // $popover=$('div:jqmData(panel="popover")'),
                $allPanels = $('div:jqmData(panel="popover"), div:jqmData(panel="menu")');

            $menu.addClass('ui-popover pop_menuBox ui-triangle-top ui-panel-active ui-element-fixed-top').removeClass('ui-panel-left ui-panel-border-right').attr('status', 'hidden').css({
                'width': '25%',
                'min-width': '250px'
            });

            // need to correct page CSS, too, because of panel position:static
            $main.find('div:jqmData(role="page")').css({
                'width': '',
                'min-width': ''
            });

            $('html').addClass('ui-multiview-active ui-popover-mode').removeClass('ui-splitview-mode');

            if ($menu.hasClass('ui-triangle-top')) {
                $menu.prepend('<div class="popover_triangle"></div>');
            }
            $main.removeClass('ui-panel-right').addClass('ui-panel-active').find('div:jqmData(role="page")').andSelf().css({
                'width': '',
                'margin-left': ''
            });

            // only add ui-popover, if we are not in fullscreen mode, otherwise conflicting CSS	
            // TODO: think about relocating this to gulliver, because requires to change all popovers, too!
            // problem is, if this is done in gulliver, ui-popover will be reassinged here, after being
            // removed in Gulliver... timing has to be exact, first popover() then gulliver()
            if (!$('html').hasClass('ui-fullscreen-mode')) {
                $allPanels.addClass('ui-popover').removeClass('pop_fullscreen');
            } else {
                $allPanels.addClass('pop_fullscreen').removeClass('ui-popover');
            }

            self.popoverBtn("plain");
            // */
        },

        splitView: function () {
            // /*									
            var self = this,
                $menu = $('div:jqmData(id="menu")'),
                $main = $('div:jqmData(id="main")'),
                $both = $('div:jqmData(id="menu"), div:jqmData(id="main")'),
                $popover = $('div:jqmData(panel="popover")');

            $menu.removeClass('ui-popover pop_menuBox ui-triangle-top ui-panel-visible ui-element-fixed-top').addClass('ui-panel-left ui-panel-active ui-panel-border-right').removeAttr('status');

            // switchable allows to hide/show menu in splitview mode, too							
            if (self.options.switchable == true && self.options.switchableHideOnLoad == true) {
                $menu.css({
                    'width': '',
                    'min-width': '',
                    'display': 'none'
                }).attr('status', 'hidden');
                // $main.find( ".ui-page" ).css({ 'margin-left'})
            } else {
                $menu.css({
                    'width': '25%',
                    'min-width': '250px',
                    'display': ''
                }).attr('status', 'visible');
            }

            $menu.children('.popover_triangle').remove();
            $main.addClass('ui-panel-right ui-panel-active');
            $menu.find('div:jqmData(show="first") .closePanel').remove();
            $popover.removeClass('pop_fullscreen').addClass('ui-popover');

            $('html').addClass('ui-multiview-active ui-splitview-mode').removeClass('ui-popover-mode');

            // insert toggle button
            if (self.options.switchable == true || $menu.jqmData("switchable") == true) {
                self.popoverBtn("switchable");
            } else {
                self.replaceBackBtn();
            }

            self.checkWidth();
            // */
        },

        popoverBtn: function (buttonType) {
            // /*			
            var self = this,

                // TODO: this is way too complex, because of all the optionalbe stuff. Can this be done easier?
                // active - in case two wrappers are in the DOM, each with menu, each with different menu properties				
                $active = $('div:jqmData(wrapper="true").ui-page-active'),

                // define placeholder for menu button
                $globalHeader = $active.find('.ui-header-global'),
                $localHeader = $active.find('div:jqmData(panel="main") div:jqmData(role="page") .ui-header'),
                $flexPos = $active.find('div:jqmData(panel="main") div:jqmData(role="page") .ui-menu-button-flex'),

                // set dropZone for menu button = this grabs all(!) relevant pages' headers
                $dropZone = $globalHeader.length ? $globalHeader : $flexPos.length ? $flexPos : $localHeader.length ? $localHeader : $('div:jqmData(panel="main") .ui-content'),

                // menu button properties (to override defaults and vary for each menu)				
                $cusIcon = $active.find('div:jqmData(panel="menu")').jqmData('menu-icon'),
                $cusIconPos = $active.find('div:jqmData(panel="menu")').jqmData('menu-iconpos'),
                $cusTheme = $active.find('div:jqmData(panel="menu")').jqmData('menu-theme'),
                $cusTxt = $active.find('div:jqmData(panel="menu")').jqmData('menu-text'),

                // customize button
                $icon = $cusIcon ? $cusIcon : self.options.menuBtnIcon,
                $text = $cusTxt ? $cusTxt : self.options.menuTxt,
                $iconpos = $cusIconPos ? $cusIconPos : self.options.menuBtnIconPos,
                $theme = $cusTheme ? $cusTheme : self.options.menuBtnTheme,

                // need later
                $menuToggle, $button, $btn;

            $dropZone.each(function (index) {

                // menu button
                $menuToggle = '<a data-iconpos="' + $iconpos + '" data-inline="true" data-icon="' + $icon + '" data-role="button" href="#" data-panel="menu" data-theme="' + $theme + '" class="ui-btn-up-' + $theme + ' ui-btn ui-btn-icon-' + $iconpos + ' ui-btn-corner-all ui-shadow popover-btn iconposSwitcher-a toggle_popover menuToggle"><span class="ui-btn-inner ui-btn-corner-all"><span class="ui-btn-text">' + $text + '</span><span class="ui-icon ui-icon-' + $icon + ' ui-icon-shadow"></span></span></a>';

                if ($(this).find('.ui-btn-left').length == 0) {
                    // empty drop zone -> insert button
                    if ($flexPos.length) {
                        if (!$(this).find('.menuToggle').length) {
                            $(this).prepend($menuToggle);
                        }
                    }


                } else {
                    // found a previous .ui-btn-left, the tricky part
                    // if it's a btn (e.g. back button) -> merge into controlgroup and set previous button to notext
                    if ($(this).find('.ui-btn-left.ui-btn').length) {
                        $button = $(this).find('.ui-btn-left.ui-btn');

                        $button.replaceWith('<div class="mergedButtons ui-corner-all ui-controlgroup ui-controlgroup-horizontal" data-type="horizontal" data-role="controlgroup"><a class="ui-controlgroup-btn-notext ui-btn ui-btn-up-' + $button.jqmData('theme') + ' ui-btn-inline ui-btn-icon-notext ui-corner-left" data-iconpos="notext" data-inline="true" data-panel="' + $button.jqmData('panel') + '" data-icon="' + $button.jqmData('icon') + '" data-role="button" href="' + $button.attr('href') + '" rel="' + $button.attr('rel') + '" title="' + $button.attr('title') + '" data-theme="' + $button.jqmData('theme') + '"><span class="ui-btn-inner ui-corner-left"><span class="ui-btn-text">' + $button.text() + '</span><span class="ui-icon ui-icon-' + $button.jqmData('icon') + ' ui-icon-shadow"></span></span></a>' + $menuToggle + '</div>');
                        // fix classes and position
                        $('.menuToggle').css({
                            'position': 'static'
                        }).addClass('ui-controlgroup-btn-left ui-btn-inline ui-corner-right').removeClass('ui-btn-corner-all ui-shadow popover-btn').find('.ui-btn-inner').addClass('ui-corner-right ui-controlgroup-last').removeClass('ui-btn-corner-all');

                    } else {
                        // if it's a section of grouped elements inside the header (only used in plugin)
                        // in this case drop the button after the first element in this button group
                        // which can be a button or controlgroup, for example like this: 								
                        // [ Back|Home Menu XYZ ] [ Title ]
                        // only add a button if there is none already!
                        if (!$(this).find('.menuToggle').length) {
                            $(this).find('.ui-btn-left').children(":first").after($menuToggle);
                            // make sure it's not pos:abs so the buttons align nicely
                            $('.menuToggle').css({
                                'position': 'static'
                            });
                        }
                    }
                }

            });

            // add switchable option
            // TODO: put somewhere else? 
            if (buttonType == "switchable") {
                $('div:jqmData(panel="menu")').addClass('switchable');
            }
            // */
        },

        splitScreen: function (event) {
            // /*			
            var self = this,
                $window = $(window);

            if ($('div:jqmData(wrapper="true")').find('div:jqmData(panel="menu"), div:jqmData(panel="main")').length == 0) {
                return;
            }

            if (event) {
                // portrait
                if (window.orientation == 0 || window.orientation == 180) {
                    if ($window.width() > self.options.$thresh) {
                        self.splitView();
                    } else {
                        self.popover();
                    }
                }
                // landscape
                else if (window.orientation == 90 || window.orientation == -90) {
                    if ($window.width() > self.options.$thresh) {
                        self.splitView();
                    } else {
                        self.popover();
                    }
                    // click, resize, init events
                    // TODO, block trash-events "from Triggers etc."
                } else if ($window.width() < self.options.$thresh) {
                    self.popover();
                } else if ($window.width() > self.options.$thresh) {
                    self.splitView();
                }
            }
            // */
        },

        context: function (object) {
            // /*
            var self = this,
                // data-context handler - a page with a link that has a data-context attribute will load that page after this page loads				
                // original only allowed for menu<>main panel context loading. By adding data-context-panel attribute this is now more flexible
                // TODO: does this need a refresh option?
                $context = object,
                $targetPanelID = $context.jqmData('context-panel');

            // in fullscreen mode, no context loading is possible
            // because which page to show?
            if (!$('html').hasClass('ui-fullscreen-mode')) {

                // make sure the pageContainer is correctly set for the 2nd transition
                $.mobile.pageContainer = $('div:jqmData(panel="' + $targetPanelID + '")');

                // context changePage
                $.mobile.changePage($($context.jqmData('context')), {
                    transition: 'slide',
                    changeHash: true,
                    fromHashChange: false,
                    pageContainer: $.mobile.pageContainer
                });

                // block next hashChange transition					
                self.options.$contextBlockNextHashChange = true;

                // TODO: I hoped this would fire with the regular pageChange-binding in mainEvents
                // but it does not. Need to fake event and data...
                // create fake objects
                var fakeEvent = {},
                    fakeData = {};

                // assign fake attributes needed to add panel history entries
                fakeEvent.target = $('div:jqmData(id="' + $context.jqmData("context-panel") + '")');
                fakeData.toPage = $($context.jqmData('context'));

                // add panel history entry for context transition
                self.stackUp("context", fakeEvent, fakeData);

            }
            // */
        },

        // scrollview handler
        scrollMe: function (panel) {
            /*
					// page selector
					var $page = panel.find('div:jqmData(role="page")');
												
					if ($.support.touch && $page.data('scrollable', 'Off')) {
						$page.data('scrollable', 'On');
						$page.find('div[data-role="content"], scrollThisY').attr('data-scroll', 'y');
												
						$page.find( ":jqmData(scroll):not(.ui-scrollview-clip)" ).each(function () {
								var $this = $( this );
					
								if ( $this.hasClass( "ui-scrolllistview" ) ) {
									$this.scrolllistview();
								} else {
									var st = $this.jqmData( "scroll" ) + "",
										paging = st && st.search(/^[xy]p$/) != -1,
										dir = st && st.search(/^[xy]/) != -1 ? st.charAt(0) : null,

										opts = {
											direction: dir || undefined,
											paging: paging || undefined,
											scrollMethod: $this.jqmData("scroll-method") || undefined
										};

									$this.scrollview( opts );
								}
							});	
							
							// 2072 enable slider in scrollview area - putting this here unfreezes screen if toolbars are hidden
							// breaks scrollview if active, check what's undefined
							// $().isChildOf - https://github.com/jquery/jquery-mobile/issues/2072					
							function isChildOf (filter_string) {

									 var parents = $(this).parents().get();

									 for (j = 0; j < parents.length; j++) {
										if ($(parents[j]).is(filter_string)) {
										   return true;
										}
									 }
									 return false;
								  }
							
							document.addEventListener('touchmove', function (e) { 
								if (!IsSlider()) { e.preventDefault(); } }, true);
							
							var hd = $.mobile.scrollview.prototype._handleDragStart;
							var hm = $.mobile.scrollview.prototype._handleDragMove;
							var hu = $.mobile.scrollview.prototype._handleDragStop;

							function IsSlider(e) {
							   var element = $(e);
							   return element.hasClass('ui-slider')
								  || element.hasClass('noscroll')
								  || element.isChildOf('.noscroll');
							}

							$.mobile.scrollview.prototype._handleDragStart = function (e, x, y) { if (IsSlider(e.target)) return; hd.call(this, e, x, y); };
							$.mobile.scrollview.prototype._handleDragMove = function (e, x, y) { if (IsSlider(e.target)) { e.preventDefault(); return; } hm.call(this, e, x, y); };
							$.mobile.scrollview.prototype._handleDragStop = function (e) { if (IsSlider(e.target)) return; hu.call(this, e); };

							
							
						}						
						*/
        },

        // helper
        // TODO: would be nice to reference from inside JQM
        findClosestLink: function (ele) {
            var self = this;
            while (ele) {
                if (ele.nodeName.toLowerCase() == "a") {
                    break;
                }
                ele = ele.parentNode;
            }
            return ele;
        },

        // helper
        // TODO: would be nice to reference from inside JQM
        getClosestBaseUrl: function (ele, documentBase) {
            var self = this;

            // Find the closest page and extract out its url.			
            var url = $(ele).closest(".ui-page").jqmData("url"),
                base = documentBase.hrefNoHash;
            if (!url || !$.mobile.path.isPath(url)) {
                url = base;
            }
            return $.mobile.path.makeUrlAbsolute(url, base);
        },

        // helper
        // TODO: would be nice to reference from inside JQM
        // TODO: does this mess up layouting?		
        removeActiveLinkClass: function (forceRemoval) {
            if ( !! $activeClickedLink && (!$activeClickedLink.closest('.ui-page-active').length || forceRemoval)) {
                $activeClickedLink.removeClass($.mobile.activeBtnClass);
            }
            $activeClickedLink = null;
        },


        // layouting functions
        gulliver: function () {
            // /*
            var self = this,
                $allPanels = $('div:jqmData(panel="popover"), div:jqmData(panel="menu")'),
                $popPanels = $('div:jqmData(panel="popover")');

            var maxHeight = 0;

            // determine whether popover height > available screen height 
            $popPanels.each(function () {
                var checkHeight = $(this).css('height'),
                    parsedHeight = parseFloat(checkHeight);

                if (parsedHeight > maxHeight) {
                    maxHeight = parsedHeight;
                }
            });

            // switch to fullscreen mode, if width < 320px OR popovers are bigger than screen height
            if (self.framer() == "small" || maxHeight > $(window).height()) {

                // make sure we popover mode is fired, so the screen is not split if the window
                // is for example 500px x 100px. Only if there are menu/main panels of course
                if ($('div:jqmData(wrapper="true").ui-page-active').find('div:jqmData(panel="menu"), div:jqmData(panel="main")').length > 0) {
                    self.popover();
                }

                // tweak for fullscreen mode
                $allPanels.removeClass('ui-triangle-top ui-triangel-bottom ui-popover ui-popover-embedded').addClass('pop_fullscreen').find('.popover_triangle').remove();

                // .iconposSwitcher - remove text on buttons in header to save space - clean this up
                $(".iconposSwitcher-div .ui-btn").not('.noSwitch').attr('data-iconpos', 'notext').removeClass('ui-btn-icon-left ui-btn-icon-right').addClass('ui-btn-icon-notext');
                $(".iconposSwitcher-select").find('.ui-icon').css({
                    'display': 'none'
                })
                $(".iconposSwitcher-div label, .iconposSwitcher-select label, .hideLabel").addClass("ui-hidden-accessible");
                $(".iconposSwitcher-a").attr('data-iconpos', 'notext').removeClass('ui-btn-icon-left ui-btn-icon-right').addClass('ui-btn-icon-notext');

                $(".noIconposSwitcher-div .ui-btn").attr('data-iconpos', 'none').removeClass('ui-btn-icon-left ui-btn-icon-right').addClass('ui-btn-icon-none');

                // set a listener to adapt height of all active pages to the height of the page currently in view. 
                // if you have a long page in the background and fire a popover in fullscreen mode, the page length 
                // should match the popovers active page length, otherwise the background page is visible underneath
                $(document).on('pagebeforeshow', $popPanels.find('div:jqmData(role="page")'), function () {
                    self.backPageHeight($(this), "set");
                });

                $('html').addClass('ui-fullscreen-mode').removeClass('ui-splitview-mode ui-popover-mode');

            } else {

                // TODO: beware of splitview or popover mode...
                // TODO: not much happening here... 
                $('html').removeClass('ui-fullscreen-mode');
                $popPanels.addClass('ui-popover');
            }

            // initialize scrollview - only on touch devices MENU and POPOVERS, if not in fullscreen mode. 
            // other scenarios handled by device scrolling or desktop scrollbars
            // if ( !$("html").hasClass('ui-fullscreen-mode')  && $("html").hasClass('touch') ) {
            // only popovers! to include menu use $allPanels
            // self.scrollMe( $popPanels );			
            // } 					
            $allPanels.each(function (index) {
                // only fire if no back button exists, as this fires on resize, too...
                if ($(this).find('.back_popover').length == 0) {

                    // all panels' first pages' close-button
                    var $closeFirstPage = ($(this).hasClass('pop_fullscreen')) ? 'back' : 'close',
                        $closeIcon = ($(this).hasClass('pop_fullscreen')) ? 'data-icon="back"' : 'data-icon="close"'
                    $backButton = '<a href="#" data-role="button" ' + $closeIcon + ' data-inline="true" data-iconpos="left" data-theme="a" class="back_popover ui-btn-left closePanel">' + $closeFirstPage + '</a>';
                    $firstPage = $(this).find('div:jqmData(show="first")').not('.ui-splitview-mode div:jqmData(panel="menu") div:jqmData(role="page")');

                    //TODO: do I need to page() again?
                    $firstPage.page();
                    $firstPage.find('div:jqmData(role="header") h1').before($backButton);
                    $(this).find('div:jqmData(show="first")').page();
                    $firstPage.find('.back_popover').buttonMarkup();
                }
            });
            // */
        },

        checkWidth: function (fromWhere) {
            // /*
            var self = this,
                $width, $menu, $menuWidth;

            // if menu panel width is set e.g. to width: 25%, min-width: 250px, the panels
            // will overlap if 25% < 250px until popover mode is fired. Corrected by this
            // TODO: now bound to or-change, also bind to resize?			
            if (self.framer() != 'small' && $('html').hasClass('ui-splitview-mode')) {

                // need this timeout for Firefox, because need to make sure panel-height is done
                // before this fires. PanelHeight takes makes sure global-header/footer + active 
                // panels > screenHeight, thereby also hiding scrollbars. In Firefox, checkwidth
                // calculates element width before panelHeight is set, so without the timeout a
                // 17px blank space will result in FF. 
                window.setTimeout(function () {
                    var $detour = $('div:jqmData(wrapper="true").ui-page-active');
                    // doesn't work anymore with Jquery 1.7.1
                    // because on show = basePage on hide = body, messes up postioning
                    // $detour = $('div:jqmData(panel="menu")').offsetParent(),
                    $menu = $('div:jqmData(panel="menu")'), $width = $detour.innerWidth(),
                    // switchable option, use menu.width = 0, if menu is hidden in splitview mode
                    $menuWidth = $menu.attr('status') == 'hidden' ? 0 : parseFloat($menu.outerWidth());

                    // should always be like this, either menu width = 250, then its overall -250
                    // or it's >250, then it also is width-menuWidth
                    $('div:jqmData(panel="main")').css({
                        'margin-left': $menuWidth,
                        'width': $width - $menuWidth
                    });
                    $('div:jqmData(panel="main") div:jqmData(role="page")').css({
                        'margin-left': $menuWidth,
                        'width': $width - $menuWidth
                    });
                    $('div:jqmData(panel="menu"):not("ui-popover") div:jqmData(role="page")').css({
                        'width': $menuWidth
                    });

                }, 10);
            } else if ($('html').hasClass('ui-popover-mode')) {
                $('div:jqmData(panel="menu") div:jqmData(role="page")').css({
                    'width': ''
                });
            }
            // */
        },

        backPageHeight: function (page, mode) {
            // /*			
            var allActive = $('.ui-page').not(page),
                maxHeight;

            // only tweak page height if a popover panel is opened
            if ($('div:jqmData(panel="popover") .ui-page-active').length > 0 && mode == "set") {

                // reference height
                maxHeight = page.outerHeight();

                // remember
                allActive.addClass("shrunk").css({
                    'height': maxHeight - 1,
                    'overflow': 'hidden'
                })
            }
            // always try to clear
            if (mode == "clear") {

                $('.shrunk').each(function () {
                    allActive.css({
                        'height': '',
                        'overflow': 'visible'
                    })
                }).removeClass('shrunk');
            }

            // */					
        },
        panelHeight: function (page) {
            // /*				
            var self = this,
                $activeWrapper = $('div:jqmData(wrapper="true").ui-page-active'),
                $panels = $activeWrapper.find('.ui-panel:not(.ui-popover)'),
                $setHeight;

            $globalHeader = $activeWrapper.find('.ui-header-global:eq(0)');
            $globalFooter = $activeWrapper.find('.ui-footer-global:last');

            if ($globalHeader.length) {
                $panels.find('div:jqmData(role="page") div:jqmData(role="content")').css({
                    'padding-top': $globalHeader.outerHeight()
                });
            }
            // why not active? back buttons in global header?
            if ($globalFooter.length) {
                $panels.find('div:jqmData(role="page") div:jqmData(role="content")').css({
                    'padding-bottom': $globalFooter.outerHeight()
                });
            }

            $setHeight = $.mobile.getScreenHeight() - $globalHeader.outerHeight() - $globalFooter.outerHeight();
            // set panel height to getScreenHeight less global header/footer
            // this will only set panel-height! both wrapper and nested page
            // height is still set by  JQM getScreenHeight()						
            $('div:jqmData(panel="main"), div:jqmData(panel="fullwidth"), div:jqmData(panel="menu")').css({
                'height': $setHeight
            });

            // menu needs to overwrite this again, otherwise does not 
            // work on iPad on orientationchange...
            if ($('html').hasClass('ui-popover-mode')) {
                $('div:jqmData(panel="menu")').css({
                    'height': ''
                });
            }
            // */
        },


        framer: function () {

            var self = $(this);
            // layout mode - need to use $(window), because $this fails in IE7+8...
            // TODO: add supersize (TV)?
            if ($.mobile.media("screen and (max-width:320px)") || ($.mobile.browser.ie && $(window).width() < 320)) {
                var framed = "small";
            } else if ($.mobile.media("screen and (min-width:768px)") || ($.mobile.browser.ie && $(window).width() >= 768)) {
                var framed = "large";
            } else {
                var framed = "medium";
            }
            return framed;
        },

        historyDump: function (panel) {

            var $panels = panel;

            // run through everything that's passed
            $panels.each(function () {
                // clear history of active (= visible) popovers. Menu only included in popover-mode!
                // TOOD: check if the windowHistoryCounter needs to be reset here, too												
                if (typeof $(this).data("stack") != 'undefined') {
                    var i = $(this).data("stack").length;
                    while (i > 1) {
                        i = i - 1;
                        $(this).data("stack").pop();
                    }
                }
            });
        },

        // panel navigation and panel hash routines
        // adding entries to panel history stacks
        stackUp: function (source, event, data) {
            // console.log("=====  panel UP, source= "+source+" =====");
            // /*							
            var self = this;

            var $targetPanel = $(event.target),
                $targetPanelID = $targetPanel.jqmData('id'),
                // if a new page was added into the DOM or into a panel data.toPage.attr 
                // will be undefined. The selector is the id of the pulled in page, 
                // (like #ext1.html) so setting targetPage to this id integrates 
                // it into the panel history navigation.
                obj = $.mobile.path.parseUrl(data.toPage);

            $targetPage = obj.hash != "" ? obj.hash : typeof data.toPage.attr('id') != undefined ? '#' + data.toPage.attr('id') : obj.filename.replace(".html", "")

            // if target panel has data-hash="history", add entry to panel stack			
            if ($targetPanel.jqmData('hash') == 'history') {
                // if main or menu is the target both need to be increased. 
                // the targeted panel gets the targetPage as entry, the other one gets a "yield" entry
                // as both menu and main can be active in splitview mode, the highest hist.length does not
                // necessarily imply the back transition is on that panel. Therefore main and menu are 
                // increased evenly, and on back transitions, the last entry not being "yield" is used.								
                if ($targetPanelID == 'menu') {
                    $('div:jqmData(panel="main")').data("stack").push("yield");
                    $('div:jqmData(panel="menu")').data("stack").push($targetPage);
                } else if ($targetPanelID == 'main') {
                    $('div:jqmData(panel="menu")').data("stack").push("yield");
                    $('div:jqmData(panel="main")').data("stack").push($targetPage);
                } else {
                    $targetPanel.data("stack").push($targetPage);
                }

                // make sure $.mobile.urlHistory stays at initial level
                var i = $.mobile.urlHistory.stack.length
                while (i > self.options.$jqmHistoryStackAtInit) {
                    i = i - 1;
                    $.mobile.urlHistory.stack.pop();
                }

                // keep count
                ++self.options.$windowHistoryCounter;

                // as a panel transition with active panel history was made,
                // back@base needs to be set to false. By only declarding inside
                // stackUp and stackDown, this will only be set once transitions
                // are made and not from init.
                // this is needed to allow JQM handleHashChange to take back over
                // once all panels are reset to base level
                $('html').data({
                    'backAtBase': false
                });

                // now that a panel transition was made, we need a lastStand blocker to ensure
                // jqm does not take over together with the last panel transition (when all stacks
                // are back at their original level, but only AFTER the last panel transition 
                // (when the lastStand has fallen...)
                // TODO: this was previously reset with every new wrapper-page being loaded into 
                // the DOM, not sure why, because it has to be a global tracker, since all 
                // panels need to be reset when a page is left
                $('html').data("lastStand", "standing");
            }


            // console.log("length="+$.mobile.urlHistory.stack.length);	
            // $.each($.mobile.urlHistory.stack, function(entry, element) {
            // 	console.log("entry "+':' + element.url);					
            // 	});						
            //  console.log("counter="+self.options.$windowHistoryCounter);
            //  console.log("stackUp full "+$('div:jqmData(id="fullwidthPage")').data('stack') );
            // console.log("stackUp pop1 "+$('div:jqmData(id="contact_setup")').data('stack') );
            //  console.log("stackUp pop2 "+$('div:jqmData(id="contact_popover2")').data('stack') );
            //	console.log("stackUp menu "+$('div:jqmData(panel="menu")').data('stack') );
            //	console.log("stackUp main "+$('div:jqmData(panel="main")').data('stack') );	
            //  console.log("ignoreNext= "+self.options.$ignoreMyOwnNextHashChange);
            //  console.log("crumbsBlockStackUp= "+self.options.$crumbsBlockStackUp);
            //  console.log("backAtBase= "+$('html').data("backAtBase"));
            //  console.log("lastStand= "+$('html').data("lastStand"));
            //  console.log("hashJoker= "+self.options.$hashJoker);
            //  console.log("contextBlockNextHashChange= "+self.options.$contextBlockNextHashChange);
            // */	
        },

        // reduce panel history stacks
        stackDown: function (source, whereToGo) {
            // console.log("=====  panel DOWN, source= "+source+" =====");			
            // /*
            var self = this,
                getHash = $.mobile.path.parseUrl(whereToGo);

            if (getHash.hash) {
                var goTo = getHash.hash;
            } else {
                var goTo = '#' + getHash.href;
            }

            var $closestPanel = $(goTo).closest('div:jqmData(role="panel")'),
                $closestPanelID = $closestPanel.jqmData('id'),
                $panels = $('div:jqmData(hash="history")'),
                longest = [],
                longestLen = 0;

            if ($closestPanelID == "menu" || $closestPanelID == "main") {

                $('div:jqmData(panel="main")').data('stack').pop();
                $('div:jqmData(panel="menu")').data('stack').pop();

            } else {
                $closestPanel.data('stack').pop();
            }

            // make sure $.mobile.urlHistory stays at initial level
            var i = $.mobile.urlHistory.stack.length
            while (i > self.options.$jqmHistoryStackAtInit) {
                i = i - 1;
                $.mobile.urlHistory.stack.pop();
            }

            // keep score
            ++self.options.$windowHistoryCounter;


            //	  console.log("length="+$.mobile.urlHistory.stack.length);	
            //	  $.each($.mobile.urlHistory.stack, function(entry, element) {
            //	  	console.log("entry "+':' + element.url);					
            //	  	});						
            //	  console.log("counter="+self.options.$windowHistoryCounter);			
            //	  console.log("stackDown full "+$('div:jqmData(id="fullwidthPage")').data('stack') );
            //	  console.log("stackDown pop1 "+$('div:jqmData(id="popover1")').data('stack') );
            //	  console.log("stackDown pop2 "+$('div:jqmData(id="popover2")').data('stack') );
            //    console.log("stackDown menu "+$('div:jqmData(panel="menu")').data('stack') );
            //	  console.log("stackDown main "+$('div:jqmData(panel="main")').data('stack') );
            //	  console.log("ignoreNext= "+self.options.$ignoreMyOwnNextHashChange);
            //	  console.log("crumbsBlockStackUp= "+self.options.$crumbsBlockStackUp);
            //	  console.log("backAtBase= "+$('html').data("backAtBase"));
            //	  console.log("lastStand= "+$('html').data("lastStand"));
            //	  console.log("hashJoker= "+self.options.$hashJoker);
            //	  console.log("contextBlockNextHashChange= "+self.options.$contextBlockNextHashChange);				
            //earned a joker = one time pass through ignoreMyOwnNextHashChange				
            self.options.$hashJoker = 1;

            // rountine for setting a flag for JQM to take back over
            // TODO: used elsewhere, too, bundle
            $panels.each(function () {
                var data = $(this).data("stack");
                if (data.length > longestLen) {
                    longest = [data];
                    longestLen = data.length;
                } else if (data.length == longestLen) {
                    longest.push(data);
                }
            });

            if (longest.length / $panels.length == 1) {
                // back@base will only be set to TRUE from stackDown, this way
                // ensuring the inital base is not falsely interpreted as back@base.
                // This is needed to allow JQM handleHashChange to take over
                // once all panels are reset to base level and to block it from
                // doing anything while transitions are made on any panel															
                $('html').data({
                    'backAtBase': true
                });
            }
            // */		
        },

        // clear active button classes	
        clearActiveClasses: function (trigger, useBruteForce, toPage, fromPage, link) {
            // /*	
            var self = this;

            // clear active buttons :-)
            if (link) {
                link.closest('.ui-btn').addClass('ui-clicked-me');
                link.closest('div:jqmData(role="page")').find('.ui-btn-active').not('.ui-clicked-me').removeClass('ui-btn-active');
                link.closest('.ui-btn').removeClass('ui-clicked-me');
            }

            // clear active links if to and from page are on the same panel
            if (toPage.closest('div:jqmData(role="panel")').jqmData("id") == fromPage.closest('div:jqmData(role="panel")').jqmData("id")) {
                // show active color for at least 1sec
                window.setTimeout(function () {
                    fromPage.find('.ui-btn').removeClass($.mobile.activeBtnClass);
                }, 1000);
            }


            // also clear active links if reverse transition on menu/main				
            if (trigger == "panelHash" && (toPage.closest('div:jqmData(panel="main")') || toPage.closest('div:jqmData(panel="menu")'))) {
                window.setTimeout(function () {
                    $('div:jqmData(panel="main"), div:jqmData(panel="menu")').find(".ui-page-active .ui-btn").removeClass($.mobile.activeBtnClass);
                }, 500);
            }

            // */										
        },

        // panel transition handler
        panelTrans: function (passedEvent, data) {

            // /*
            // vars
            var self = this,
                // override pagebeforechange with click events in case there is one
                event = self.options.$stageEvent || passedEvent,
                link = $(self.findClosestLink(event.target)),
                $link = $(link),
                transition = data.options.transition,
                direction = data.options.direction,
                reverse = data.options.reverse,
                role = data.options.role,
                isRefresh = data.options.isRefresh;

            // panel transition vars
            var $targetPanel = data.options.pageContainer,
                $targetPanelID = $targetPanel.jqmData('id'),
                $targetPanelActivePage = $targetPanel.children('div.' + $.mobile.activePageClass),

                $currPanel = data.options.fromPage.parents('div:jqmData(role="panel")'),
                $currPanelID = $currPanel.jqmData('id'),
                $currPanelActivePage = $currPanel.children('div.' + $.mobile.activePageClass),

                href = $.mobile.path.makeUrlAbsolute(data.toPage),
                url = $.mobile.path.stripHash(data.toPage);

            // set scrollTop blocker to keep popover panels visible when loading a new page into the DOM									
            if (($targetPanel.jqmData("panel") || $currPanel.jqmData("panel")) == "popover") {
                self.options.$panelTransBlockScrollTop = true;
            }

            hashChange = $targetPanel.jqmData('hash') == 'history' ? true : false;
            from = ($targetPanelID != $currPanelID) ? $targetPanelActivePage : $currPanelActivePage;

            $.mobile.changePage(href, {
                fromPage: from,
                transition: transition,
                changeHash: hashChange,
                reverse: reverse,
                pageContainer: $targetPanel,
                reloadPage: isRefresh
            });


            // clear stageEvent for next transition
            self.options.$stageEvent = '';

            // allow next pagebeforecreate to pass again
            self.options.$infinity = '';

            // set a flag for pushState passing along the url to load. 
            // if pushState is supported and a new page is loaded (isPath),
            // JQM will grab the URL (which should be xyz.html and append
            // it to the wrapper page vs. replacing the wrapper page and 
            // breaking back button/history along the way. This flag will
            // be reset with every panelTransition and reset inside the
            // pushStateHandler
            $('html').data('pushStateFlag', url);

            // TODO: same as context, handler, create fakeEvent and fakeData
            var fakeEvent = {},
                fakeData = data;

            // assign fake attributes needed to add panel history entries
            fakeEvent.target = $targetPanel;

            // block stack adding if it was a crumbs based (reverse) transition				
            if (self.options.$crumbsBlockStackUp == false) {
                self.stackUp("panelTrans", fakeEvent, fakeData);
            }
            // if set to true in order to block a crumbs backward transition
            // firing a stackUp event, reset to false, so next regular 
            // transition works again
            if (self.options.$crumbsBlockStackUp == true) {
                self.options.$crumbsBlockStackUp = false
            }

            // call active class clearing				
            self.clearActiveClasses("panelTrans", true, $(data.toPage), from, $link);


            // set the Joker, to detect whether panelTrans fired
            // or not. In panelHash I can check for the joker.
            // if it's not set, panelTrans did not fire before,
            // so it would be a hashchange only transition and
            // then I can set $ignoreMyOwnNextHashChange accordingly
            // to allow subsequent hashChange (back button) transitions
            // to pass. 				
            self.options.$hashJoker = 0;
            // keep it false! 								
            self.options.$ignoreMyOwnNextHashChange = false;

            //make sure wrapper page stays activePage		
            $.mobile.activePage = $('div:jqmData(wrapper="true")');


            // reset page container to prevent regular JQM loading pages into a container
            // pageContainer will be re-set on next panel-transition to correct panel,
            // but if a regular JQM transition fires pageContainer would be stuck at the 
            // panel the last page was loaded into. Therefore reset (like for the loader:
            $.mobile.pageContainer == $('body') ? $.mobile.pageContainer : $('body');
            // */
        },

        // panel hashchange handler
        panelHash: function (e, hash, fullHash) {

            // /*
            // remove panelHash again
            var self = this;

            // stop Android for 500ms
            window.setTimeout(function () {
                self.options.$blockMultiClick = false;
            }, 500);

            // stop JQM 
            e.preventDefault();

            // JQM to and dialog hashkey
            var to = $.mobile.path.stripHash(hash),
                dialogHashKey = "&ui-state=dialog",

                // check for history-panels
                $panels = $('div:jqmData(wrapper="true").ui-page-active div:jqmData(hash="history")'),
                n = $panels.length;

            // setup stack array
            longest = [], longestLen = 0;

            //transition is false if it's the first page, undefined otherwise (and may be overridden by default)	
            transition = ($.mobile.urlHistory.stack.length === 0 || n == 0) ? "none" : undefined,

            // options
            changePageOptions = {
                transition: transition,
                changeHash: false,
                fromHashChange: true,
                pageContainer: null,
            };

            // block hashChanges firing from regular JQM transition, 
            // when the plugin panel history is active, it keeps the
            // $.mobile.urlHistory.stack at length saved at init. 
            // Therefore a stack higher than 1 should not be possible 
            // on a wrapper. 
            // This is needed for dialogs. Check to see if it breaks something else! 				
            if ($.mobile.urlHistory.stack.length > self.options.$jqmHistoryStackAtInit) {
                return;
            }

            // this blocks hashChange calls set from panel-based transitions
            // otherwise the panelHash will fire two transitions! 	
            // joker enables more than one subsequent backward transitions									
            if (self.options.$ignoreMyOwnNextHashChange == false && self.options.$hashJoker == 0) {
                self.options.$ignoreMyOwnNextHashChange = true;
                self.options.$hashJoker = 1;
                return;
            }

            // first context hashChange is correctly blocked before, 
            // 2nd one passes and is stopped here				
            if (self.options.$contextBlockNextHashChange == true) {
                self.options.$contextBlockNextHashChange = false;
                self.options.$blockContextScrollTop = true;
                return;
            }

            // block pagination hashChanges				
            if (self.options.$blockPaginationHashChange == true) {
                self.options.$blockPaginationHashChange = false;
                return;
            }

            // --------------------------- panel history rountine ------------------------
            // works like this:
            // * every panel with data-hash="history" gets a history stack on panel-init
            // * panel stacks receive entries (hash only) on every changePage
            // * initial stack height = 1 = panel page withd data-show = first
            // * popover panel stacks only increase while visible and are reset to 1 when the panel hides
            // * popover panel stacks always supercede all other panels 
            // * = first undo the panel, then the rest
            // * main&menu stack increase together, so if you change page on menu
            // * main gets a "yield" entry. So they always have the same stack height
            // on every transition plugin checks all stacks for the heightest
            // a new array is created from the heighest stacks (may be more than one)
            // only when all panels are on the same height (should be =1) JQM is allowed
            // to do a regular hashChange.
            // example: 3 higehst stacks with 2 entries each, the combo-array longest[]
            // will contain 3 arrays [array1, array2, array3] and each array will contain two entries
            // if there are panels with active history, check them
            if (n) {
                $panels.each(function () {
                    var data = $(this).data("stack");
                    if (data.length > longestLen) {
                        longest = [data];
                        longestLen = data.length;
                    } else if (data.length == longestLen) {
                        longest.push(data);
                    }
                });
            }

            // --------------------------- start JQM copy ------------------------ 
            // TODO: try referencing directly into JQM, this is duplicate code
            //existing base tag?
            var $base = $('head').children("base"),

                //tuck away the original document URL minus any fragment.
                documentUrl = $.mobile.path.parseUrl(location.href),

                //if the document has an embedded base tag, documentBase is set to its
                //initial value. If a base tag does not exist, then we default to the documentUrl.
                documentBase = $base.length ? $.mobile.path.parseUrl($.mobile.path.makeUrlAbsolute($base.attr("href"), documentUrl.href)) : documentUrl;

            // --------------------------- end JQM copy ------------------------ 								
            // (I)	
            if (to) {

                to = (typeof to === "string" && !$.mobile.path.isPath(to)) ? ($.mobile.path.makeUrlAbsolute('#' + to, documentBase)) : to;

                // (1) TODO: remove longest.length/n, because it fails if main/menu at 2 = 2/2=1
                if (n == 1 || longest.length / n !== 1 || longestLen > 1) {
                    // for example 4 stacks, height 2,2,2,4 > longest.length = 1 /n=4 = 0,25 = panelHistory
                    // (a) first check if a popover is active with a stack>1, this will be reduced first
                    var activePop = $('.ui-panel-active.ui-popover');

                    if (activePop.length > 0 && activePop.data("stack").length > 1) {
                        var pickFromStack = activePop.data("stack"),
                            gotoPage = pickFromStack[pickFromStack.length - 2];
                    } else {
                        // (b) if all popovers are reset, check for highest fullwidth or main/menu panel								
                        var gotoPage = self._mmHandler(longest.length, longest, longestLen);
                    }

                    // need to declare fromPage here, because otherwise JQM removes .ui-page-active from the wrong panel (= active page in main panel);
                    var fromPage = $(gotoPage).closest('div:jqmData(role="panel")').find('.ui-page-active'),
                        changePageOptions = {
                            fromPage: fromPage,
                            pageContainer: $(gotoPage).closest('div:jqmData(role="panel")'),
                            fromHashChange: true,
                            changeHash: false
                        };

                    $.mobile.changePage(gotoPage, changePageOptions);

                } else {
                    // (2) basic setup of all panels, n=1, base setup, mimic JQM							
                    // TODO check if this really works or if the counter needs to be used
                    window.history.back();
                    //window.history.go(-self.options.$windowHistoryCounter);
                    self.options.$windowHistoryCounter = 1;
                    return;
                }

                // (II no "to")
            } else {

                // if "to" is not defined, it would be normal JQM, if not for the backwards transition
                // to the data-show="first" page on each panel. Since the URL doesn't show the #menu-1st, 
                // #main-1st, etc page at the beginning, a backward transition to this page result in #hash
                // being undefined, so we land here... and need the whole logic again
                // TODO: this has to be possible in a better way... 						
                // as we are going back to data-show=first, remove any global header crumbs button
                $('div:jqmData(wrapper="true").ui-page-active').find('.ui-header-global .ui-crumbs').remove();

                // (1) TODO: remove longest.length/n, because it fails if main/menu at 2 = 2/2=1
                if (n == 1 || longest.length / n !== 1 || longestLen > 1) {
                    var activePop = $('.ui-panel-active.ui-popover');
                    // (a)									
                    if (activePop.length > 0 && activePop.data("stack").length > 1) {
                        var pickFromStack = activePop.data("stack"),
                            gotoPage = pickFromStack[pickFromStack.length - 2];
                    } else {
                        // (b)																			
                        var gotoPage = self._mmHandler(longest.length, longest, longestLen);
                    }

                    var fromPage = $(gotoPage).closest(':jqmData(role="panel")').find('.ui-page-active'),
                        changePageOptions = {
                            fromPage: fromPage,
                            pageContainer: $(gotoPage).closest('div:jqmData(role="panel")'),
                            fromHashChange: true,
                            changeHash: false
                        };

                    $.mobile.changePage(gotoPage, changePageOptions);

                } else {
                    // (2)										
                    // need to make a backward/forward transition here... first page of the app. 
                    if (longest.length / n == 1) {

                        window.history.back();
                        return;
                    } else {
                        var gotoPage = $.mobile.firstPage;
                        $.mobile.changePage($.mobile.firstPage, changePageOptions);
                    }

                }

            }

            // as we have now made a transition, we need to block the next one coming from behind
            // same as in changePage handler							
            // self.options.$ignoreMyOwnNextHashChange = false;				
            self.options.$ignoreMyOwnNextHashChange = false;

            // reduce panel stacks
            // self.stackDown( "panelHash", gotoPage.replace(/[#]/, "") );
            self.stackDown("panelHash", gotoPage);

            // call active class clearing
            // maybe not... because also fires with regular JQM transitions
            // TODO: COMMENT OUT
            // self.clearActiveClasses( "panelHash", true, $(gotoPage), fromPage );
            // not sure I need to set this.
            // $.mobile.firstPage[ 0 ] = gotoPage;	
            // reset page container to prevent regular JQM loading pages into a container
            // pageContainer will be re-set on next panel-transition to correct panel,
            // but if a regular JQM transition fires pageContainer would be stuck at the 
            // panel the last page was loaded into. Therefore reset (like for the loader:
            $.mobile.pageContainer == $('body') ? $.mobile.pageContainer : $('body');

            // */
        },

        panelDeepLink: function () {

            // /*
            // load deeplinked pages						
            var self = this,
                // grab deeplink from HTML tag
                $deepPage = $($('html').data("multiviewDeeplink")),
                $deepPanel = $deepPage.closest('div:jqmData(role="panel")'),
                $deepPanelID = $deepPage.closest('div:jqmData(role="panel")').jqmData('id'),
                $deepFrom = $deepPanel.find('div:jqmData(show="first")'),
                $triggerButton;


            // if the deeplink page is on a popover
            if ($deepPanel.jqmData("panel") == "popover") {
                $triggerButton = $('div:jqmData(wrapper="true")').find('.toggle_popover:jqmData(panel="' + $deepPanelID + '")');
            }

            // make sure, first panel page is not enhanced, if deeplinking to a panel page other than 
            // data-show="first" page				
            if ($deepFrom.attr('id') != $deepPage.attr('id')) {
                $deepFrom.removeClass('ui-page-active');
            }


            // this needs a timeout, otherwise popovers will be closed
            // before opening by the last loading scrollTop (not sure, 
            // but deeplinked popovers won't open without a Timeout
            // show popover if there is one, but only if it's not visible already				
            if ($triggerButton && $deepPanel.attr('status') != 'visible') {
                $triggerButton.trigger('click');
            }

            // make sure, there is no trailing hashChange messing things up
            self.options.$ignoreMyOwnNextHashChange = false;

            // load deeplink page
            $.mobile.changePage($deepPage, {
                fromPage: $deepFrom,
                transition: "slide",
                reverse: true,
                changeHash: false,
                pageContainer: $deepPanel
            });


            // tidy up HTML deeplink
            $('html').removeData("multiviewDeeplink");
            // */
        },

        // determines which panels to add entries to
        _mmHandler: function (howMany, longest, longestLen) {
            // /*			
            // (b-1), single highest panel can now only be a fullwidth panel
            if (howMany == 1) {
                var gotoPage = longest[0][longestLen - 2].toString();
                // minus one								
                // var pickFromStack = $( longest[0][0] ).closest(':jqmData(role="panel")');
                // pickFromStack.data("stack").pop();
                return gotoPage;
            }
            // (b-2) two highest panels, can only be menu/main
            if (howMany == 2) {
                var $last0 = longest[0][longestLen - 1].toString(),
                    $last1 = longest[1][longestLen - 1].toString();

                // main/menu (increase simultaneously - passive entry = "yield")
                // backwards transition should be made to last entry not being yield
                // starting from stackHeight-1 (otherwise result will be currently 
                // active page
                if ($last0 == "yield") {
                    for (i = longestLen - 2; i >= 0; i--) {
                        if (longest[1][i].toString() != "yield") {
                            var gotoPage = longest[1][i].toString();
                            break;
                        }
                    }
                } else if ($last1 == "yield") {
                    for (i = longestLen - 2; i >= 0; i--) {
                        if (longest[0][i].toString() != "yield") {
                            var gotoPage = longest[0][i].toString();
                            break;
                        }
                    }
                }

                // minus one on both
                // var $popLast0 = $( longest[0][0] ).closest(':jqmData(role="panel")');								
                // $popLast0.data("stack").pop();
                // var $popLast1 = $( longest[1][0] ).closest(':jqmData(role="panel")');								
                // $popLast1.data("stack").pop();								
                return gotoPage;
            }


            // (b-3)[may want to keep] working selector for more than 3 panels with highest stack
            //if (howMany == 3) {
            //	var $last = [];
            //	for ( var i = 0; i < longest.length; i++) {							
            //		$last.push( longest[i][ longest[i].length - 1 ] );						  						  
            //		if ( $( $last[i] ).closest(':jqmData(role="panel")').jqmData('panel')  == "popover" ) { 
            //			var gotoPage = $last[i];
            //			}						  
            //		}
            //	return gotoPage;
            //	// need to reduce stacks!
            //	}
            // */
        },

        _mainEventBindings: function () {

            var self = this;

            // avoid header mixplacing when closing keyboard on iOS
            $(document).on("blur", "div:jqmData(wrapper='true') input", function () {
                $(".ui-header-fixed, .ui-element-fixed-top").css("top", "0 !important");
            });

            // click binding
            $(document).on("click", function (event) {

                // store event for panelTrans
                self.options.$stageEvent = event;

                var link = $(self.findClosestLink(event.target));

                if (!link || event.which > 1) {
                    return;
                }

                // context routine
                if (link.length === 1 && link.jqmData('context')) {
                    self.context(link);
                }

            });

            $(document).on("pagebeforechange", function (e, data) {

                if (self.options.$infinity != "block" && data.options.pageContainer != $.mobile.pageContainer) {

                    // stop JQM
                    e.preventDefault();

                    // set a blocker, otherwise we're creating an infinite loop
                    self.options.$infinity = "block"
                    // fire panel transition
                    self.panelTrans(e, data);
                }
            });

            // listener for plugin setup on trigger wrapper-page and subsequent wrappers added 
            // to the DOM. This also sets up crumbify buttons
            // TODO: Think about separating...						
            $(document).on('pagebeforeshow', 'div:jqmData(role="page")', function (event, data) {

                var page = $(this);

                // if pageshow is for a wrapper-page, setup the plugin
                if (page.jqmData('wrapper') == true) {
                    // make sure visible panels have an active first-page on backwards transitions
                    if (page.find('.ui-panel[status="visible"] .ui-page-active').length == 0) {
                        page.find('div:jqmData(show="first")').addClass('ui-page-active');
                    }

                    // if it's a deeplink page, fire panelDeeplink
                    if ($('html').data("multiviewDeeplink") && page.find($('html').data("multiviewDeeplink") + "").length >= 1) {
                        // self.panelDeepLink();
                    }

                    // the setup for wrappers should only run once, which is
                    if (page.data("counter") == 0 || typeof page.data("counter") == 'undefined') {

                        self.setupMultiview(event, page);

                        // .....hard... because it seems not possible to 
                        // live('pagecreate/pageload/pageinit') to the wrapper
                        // page alone. Such a binding fires with every panel
                        // changepage, so it's not possible to set a flag on a wrapper 
                        // to block the setup from firing more than once. Using "one"
                        // instead of "live" also does not work, because then you
                        // cannot catch the 2nd wrapper page loaded into the DOM.
                        // $(this).die(), also doesn't seem to work. 
                        // The whole thing is necessary, because the plugin setup
                        // adds active-page to the first page on every panel. If
                        // I let this fire with every changePage, the firstpage 
                        // will never loose active-page and thus always be visible
                        // If I omit this call, the 2nd wrapper page loaded into 
                        // the DOM will not get the plugin setup and be blank.
                        // What this does: The counter for the first wrapper page
                        // is set to 0 on plugin-init so it runs through here once,
                        // gets changed to 1 and thus is blocked from going through
                        // again. If a new wrapper is loaded it doesn't have any , 
                        // counter so I'm also letting "undefined" pass and then set 
                        // the counter for this wrapper to 1, so on the next changePage,  
                        // pageshow will fire on the wrapper page, but as counter is now 
                        // 1, it will not run through here. This took a while...
                        var inc = 1;
                        page.data("counter", 0 + inc);
                    } else {
                        // wrapper already is in the DOM, just update the layout	
                        self.checkWidth();
                    }
                    // the crumbs part	
                    // as it's a wrapper page we don't need crumble buttons on it, so stop here
                    event.preventDefault();
                } else if (page.closest('div:jqmData(role="panel")').jqmData('hash') && page.jqmData("show") != "first") {
                    // fires crumble every time a page is created
                    // by checking for a closest panel, we ensure it's not fired on a regular JQM page!	
                    // need to delay this, otherwise this runs before the history stacks are updated, 10ms seems enough
                    window.setTimeout(function () {
                        self.crumble(event, data, page);
                    }, 10);
                }
            });

            // clear history once user navigates away from it
            $(document).on('pagehide', 'div:jqmData(role="page").basePage', function (e, data) {


            })

            // fire splitviewCheck on orientationchange (and resize)
            $(window).on('orientationchange', function (event) {
                self.splitScreen(event);
                self.checkWidth();
                self.panelHeight();
                self.gulliver();
            });

            // panel history handler
            $(window).on('hashchange', function (e) {

                if (self.options.$blockMultiClick == false) {
                    self.options.$blockMultiClick = true;
                    self.panelHash(e, location.hash, "#" + location.pathname);
                }
            });


            // history stack management with crumbs buttons active
            $(document).on('click', 'a.ui-crumbs', function () {
                var $this = $(this),
                    // global/local header
                    $whereToGo = $this.closest('div:jqmData(role="page")').jqmData('wrapper') == true ? $this.attr('href') : $this.closest('div:jqmData(role="page")').attr('id')

                    self.options.$ignoreMyOwnNextHashChange = false;
                self.options.$crumbsBlockStackUp = true;
                self.stackDown("crumbs", $whereToGo);
            });

        }

    });

    // plugin flag
    $('html').data("lockup", "unlocked");

    // initialize single DOM instance of multiview with first wrapper page
    var trigger = $(document).on('pagecreate', 'div:jqmData(wrapper="true")', function (event) {

        if ($('html').data("lockup") == "unlocked") {
            // initialize a counter to avoid setup of plugin firing with every pageshow
            $(this).data("counter", 0);
            $(this).multiview();
            $('html').data("lockup", "locked");
        }
    });

})(jQuery, this);