(function($) {
  var uiNamespace; //Convenient ref to a namespacey thing.
  Drupal.behaviors.cycoSelectRubricUi = {
    //Id of the selected rubric item.
    selectedItemNid: null,
    //Term ids the user has checked in the tree.
    checkedTermIds: new Array(),
    //Nids of the rubric items shown in the filtered list.
    filteredNids: new Array(),
    //CSS class attached to selected item.
    selectedItemClass: "rubric-select-selected-item",
    attach: function(context, settings) {
      uiNamespace = Drupal.behaviors.cycoSelectRubricUi;
      //Hide the templates for the interfaces that Drupal added to the page.
      $("#rubric-select-current-items-ui").hide();
      $("#rubric-select-ui").hide();
      $(".rubric-select-current-item-container").hide();
      uiNamespace.showAjaxThrobber();
      $.when(
        uiNamespace.getCsrfToken()
      )
      .then(function() {
        //Grab vocab terms and rubric items from server.
        $.when( 
          uiNamespace.fetchTerms(),
          uiNamespace.fetchRubrics()
        )
        .then(function() {
          //Prep the UI.
          uiNamespace.prepareUi();
          //Prep the add new item UI.
          Drupal.behaviors.cycoCreateRubricUi.startMeUp();
          uiNamespace.hideAjaxThrobber();
        })
        .fail(function() {
          alert("The voles died.");
        });
      })
      .fail(function() {
        alert("The gerbils died.");
      });
    },
    /**
     * Get a CSRF token.
     * @returns {unresolved} Promise.
     */
    getCsrfToken: function(){
//      console.log("Getting token");
      //Connect and get user details.
      var webServiceUrl = Drupal.settings.basePath + "services/session/token";
//      $("#activity").show();
      var promise = $.ajax({ 
          type: "GET",
          url: webServiceUrl,
          dataType: "text"
      })
        .done(function(token){
          uiNamespace.token = token;
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          console.log('Token request failed! ' + textStatus + errorThrown); 
        })
        .always(function() {
//          $("#activity").hide();
        }); 
      return promise;
    },
    /**
     * Fetch the vocab terms (for the vocab rubric items use) from the server.
     */
    fetchTerms: function() {
      var webServiceUrl = Drupal.settings.basePath + "exercise/rubric_item_categories/getTree";
      var promise = $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: "json", url: webServiceUrl,
        beforeSend: function (request) {
          request.setRequestHeader("X-CSRF-Token", uiNamespace.token);
        }
      })
        .done(function(result) {
          uiNamespace.termsServerData = result;
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          alert('getJSON request failed! ' + errorThrown);
        });
      return promise;
    },
    /**
     * Fetch data on all rubric items from the server.
     */
    fetchRubrics: function() {
      var webServiceUrl = Drupal.settings.basePath
        + "exercise/rubric_item/getTitlesCategories";
      var promise = $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: "json", 
        url: webServiceUrl,
        beforeSend: function (request) {
          request.setRequestHeader("X-CSRF-Token", uiNamespace.token);
        }
      })
        .done(function(result) {
          uiNamespace.rubricsServerData = result;
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          alert('getJSON request failed! ' + errorThrown);
        });
      return promise;
    },
    /**
     * Use the fetched data to prep the UI.
     */
    prepareUi: function() {
      //Show the rubric items already associated with the exercise.
      uiNamespace.showExistingItems();
      //Set up events for Edit and Unlink buttons fo existing items.
      $("#rubric-select-current-items-ui").click(function(event) {
        var $target = $(event.target);
        if ( $target.prop("tagName") == "BUTTON" ) {
          //User clicked on a button.
          //Is there an nid?
          var nid = $target.parent().attr("data-nid");
          if ( nid ) {
            //There is an nid, so it's either the Edit or Unlink button.
            var caption = $target.text();
            if ( caption == "Unlink" ){
              uiNamespace.unlinkItem( nid );
            }
            else if ( caption == "Edit" ){
              Drupal.behaviors.cycoCreateRubricUi.showCreateItemUi( nid );
            }
          }//End there is a nid
        }
      });
      //Set up the Create button.
      $("#rubric-select-create").click(function() {
        Drupal.behaviors.cycoCreateRubricUi.showCreateItemUi( 0 );
      });
      //Set up the Edit button.
      $("#rubric-select-edit").click(function() {
        Drupal.behaviors.cycoCreateRubricUi
            .showCreateItemUi( uiNamespace.selectedItemNid );
      });
      
      //Create the UI for linking additional items.
      uiNamespace.createUi4LinkingItems();
      //Create the dialog for viewing/adding/editing rubric items.
      
      //Set up the button that triggers the interface for linking
      //additional items.
      uiNamespace.setupAddItemLinkButton();
      //Show the existing terms interface.
      $("#rubric-select-current-items-ui").show("fast");
    },
    /*
     * Unlink an item from the exercise.
     * @param {type} nid Nid of the item to unlink.
     */
    unlinkItem: function( nid ) {
      //Remove item from list of linked items.
      //See http://stackoverflow.com/questions/3954438/remove-item-from-array-by-value
      //nid must be numeric.
      nid = parseInt(nid);
      var index = $.inArray( nid, uiNamespace.linkedItems );
      if ( index === -1 ) {
        alert("bad things!");
        return;
      }
      uiNamespace.linkedItems.splice(index, 1);
      //Remove the display.
      $(".rubric-select-current-item-container[data-nid='" + nid + "']")
          .remove();
      //Update Drupal's hidden field that has a JSON array of linked items.
      uiNamespace.updateDrupalItemList( uiNamespace.linkedItems );
    },
    updateDrupalItemList: function( itemNids ) {
      $('[name="cyco_current_items"]').val( "[" + itemNids.toString() + "]" );
    },
    /**
     * Show the rubric items already associated with the exercise.
     */
    showExistingItems: function() {
      //Grab the template for existing items.
      uiNamespace.existingItemTemplate = 
        $(".rubric-select-current-item-container").remove();
      //Get items nids from a hiddden form field.
      uiNamespace.linkedItems 
          = JSON.parse( $('[name="cyco_current_items"]').val() );
      //Make a display for each linked item.
      var itemNid, i;
      for ( i = 0; i < uiNamespace.linkedItems.length; i++ ) {
        itemNid = uiNamespace.linkedItems[i];
        uiNamespace.displayLinkedItem( itemNid );
      }
    },
    /*
     * Create the UI for linking a rubric item to an exercise.
     */
    createUi4LinkingItems: function() {
      //Create data structure for tree.
      uiNamespace.treeNodes = uiNamespace.createTreeDataStructure();
      //Create the tree.
      uiNamespace.createTreeDisplay( uiNamespace.treeNodes );
      //Add all rubric items to the filtered list initially.
      uiNamespace.filteredNids = uiNamespace.getAllItemsIds();
      //Remove from the list of filtered (matching) items those
      //items that already have been linked to the exercise.
      uiNamespace.filteredNids = uiNamespace.removeAlreadyLinkedItems( 
          uiNamespace.filteredNids, uiNamespace.linkedItems
      );
      //Show the items.
      uiNamespace.updateFilteredItemDisplay();
      //Set up button events.
      uiNamespace.setupAddItemUiButtons();
    },
    /*
     * Create the data structure for the term tree.
     */
    createTreeDataStructure: function() {
      var treeNodes = new Array();
      $(uiNamespace.termsServerData).each(function(index, term) {
        //A treeNode for a term.
        var treeNode = {
          title: term.title,
          key: term.tid,
          parentId: term.parent_tid,
          expanded: true
        };
        //Put a ref to the treeNode in the server data object.
        uiNamespace.termsServerData[index].node = treeNode;
        //Add the tree node to treeNodes.
        if ( term.parent_tid == 0 ) {
          //No parent.
          treeNodes.push( treeNode );
        }
        else {
          //The new node is a child.
          //Get ref to the parent node.
          var parentNode = null;
          for (var i = 0; i < uiNamespace.termsServerData.length; i++) {
            if ( uiNamespace.termsServerData[i].tid == treeNode.parentId ) {
              parentNode = uiNamespace.termsServerData[i].node;
              break;
            }
          }
          if ( parentNode === null ) {
            alert('blagh!');
            return;
          }
          //Make sure the parent node has a children property.
          parentNode.children = parentNode.children || new Array();
          //Add the new node to the parent's children collection.
          parentNode.children.push( treeNode );
        }
      }); //End each
      return treeNodes;
    },
    /*
     * Create the term tree display from the data structure.
     * @param Array treeNodes Data structure, tree of terms.
     */
    createTreeDisplay: function( treeNodes ) {
      //Create the tree display object.
      uiNamespace.tree = $("#term-tree").fancytree({
        source: treeNodes,
        icons: false,
        checkbox: true,
        selectMode: 2,
        select: this.termChecked,
        beforeActivate: function(event, treeData) {
          //Trigger selected instead.
          treeData.node.toggleSelected();
          return false;
        },
      });
    },
    /*
     * Add all of the rubric items to the filtered list. 
     */
    getAllItemsIds: function() {
      var items = new Array();
      var nid, i;
      for (i = 0; i < uiNamespace.rubricsServerData.length; i++) {
        nid = uiNamespace.rubricsServerData[i].nid;
        //Remember that this item is in the filtered list.
        items.push( nid );
      }
      return items;
    },
    /*
     * Set up the buttons in the bottom right of the add item UI.
     */
    setupAddItemUiButtons: function() {
      //Set up click event for rubric items. (Attached to parent UL rather than LIs.
      $("#filtered-terms").click( this.rubricItemSelected );
      //Buttons states
      $("#rubric-select-edit").attr("disabled", "disabled");
      $("#rubric-select-link")
          .attr("disabled", "disabled")
          .click(function(event) {
            if ( uiNamespace.selectedItemNid ) {
              //Link the selected item.
              uiNamespace.linkItem( uiNamespace.selectedItemNid );
            }
          });
      //Handler for the cancel button.
      $("#rubric-select-cancel").click(function() {
        //Hide the add item UI.
        $("#rubric-select-ui").hide();
        //Show the button that shows the add item UI.
        $("#rubric-select-link-item").show();
        //Scroll to the rubric area.
        $('html, body').animate({
            scrollTop: $("#rubric-select-current-items-ui-title")
                         .offset().top - 100
        }, 200);
      });
    },
    /*
     * Link a rubric item to the exercise (client-side).
     * @param int itemNid nid of the item.
     */
    linkItem: function( itemNid ) {
      //Hide the add item UI.
      $("#rubric-select-ui").hide();
      //Add new item to linked item list.
      uiNamespace.linkedItems.push( itemNid );
      //Update Drupal's hidden field that has a JSON array of linked items.
      uiNamespace.updateDrupalItemList( uiNamespace.linkedItems );
      //Create a display for it.
      var itemDisplay = uiNamespace.displayLinkedItem( itemNid );
      //Show the button that shows the add item UI.
      $("#rubric-select-link-item").show();
      //Scroll to the new item.
      $('html, body').animate({
          scrollTop: itemDisplay.offset().top - 100
      }, 200);
    },
    /*
     * Make a display for a linked item.
     * @param int itemNid Nid of the linked item.
     */
    displayLinkedItem: function( itemNid ) {
      //Clone the item template.
      var itemDisplay = $(uiNamespace.existingItemTemplate).clone();
      //Adjust the clone for the current item.
      itemDisplay.attr("data-nid", itemNid);
      var itemTitle = uiNamespace.findRubricItem( itemNid ).title;
      itemDisplay.find(".rubric-select-current-item-title").text(itemTitle);
      //Insert into DOM.
      $("#rubric-select-link-item-container").before( itemDisplay );
      //Show it.
      itemDisplay.show("fast");
      return itemDisplay;
    },
    /**
     * Set up the button that, when clicked, shows the UI for linking
     * a rubric item to the exercise.
     */
    setupAddItemLinkButton: function() {
      $("#rubric-select-link-item").click(function() {
        $(this).hide();
        uiNamespace.showAddItemUi();
      });
    },
    /*
     * Show the display for adding new items.
     */
    showAddItemUi: function() {
      //No item is selected.
      uiNamespace.selectedItemNid = null;
      $("." + uiNamespace.selectedItemClass )
        .removeClass(uiNamespace.selectedItemClass);
      //Disable the Link and Edit buttons until the user selects an item.
      $("#rubric-select-edit").attr("disabled", "disabled");
      $("#rubric-select-link").attr("disabled", "disabled");
      //If there are no terms checked, then show all items.
      if ( uiNamespace.checkedTermIds.length == 0 ) {
        uiNamespace.filteredNids = uiNamespace.getAllItemsIds();
      }
      else {
        //Filter rubric items with checked terms.
        uiNamespace.filteredNids = uiNamespace.findMatchingItems(
            uiNamespace.checkedTermIds
        );
      }
      //Remove from the list of filtered (matching) items those
      //items that already have been linked to the exercise.
      uiNamespace.filteredNids = uiNamespace.removeAlreadyLinkedItems( 
          uiNamespace.filteredNids, uiNamespace.linkedItems
      );
      //Update the filtered items display.
      uiNamespace.updateFilteredItemDisplay();
      //Show the UI.
      $("#rubric-select-ui").show("fast");
    },
    returnFromAddItemUi: function( item ) {
      var itemNid = item.nid;
      var itemTitle = item.title;
      //Loop across item list. If find item with same nid, update title.
      //If not, add a new entry to the list.
      var elementNid;
      var foundIt = false;
      $("#filtered-terms li").each(function(index, element){
        elementNid = $(element).attr("data-nid");
        if ( elementNid == itemNid ) {
          element.text( itemTitle );
          foundIt = true;
        }
      });
      if ( ! foundIt ) {
        //Add the data to the server data array.
        //From http://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-clone-an-object
        var itemClone = $.extend(true, {}, item);
        uiNamespace.rubricsServerData.push( itemClone );
        //Add a new item.
        $("#filtered-terms").append("<li data-nid='" + itemNid + "'>" 
            + itemTitle + "</li>");
      }
    },
    /*
     * User checked a term in the tree.
     * @param {type} event
     * @param {type} treeData Data about the tree, including nodes.
     * @returns {undefined}
     */
    termChecked: function( event, treeData ) {
//      try {
        document.body.style.cursor = 'wait';
        //Update the list of items the user has checked.
        uiNamespace.checkedTermIds = uiNamespace.findCheckedTerms();
        //Filter rubric items with those terms.
        uiNamespace.filteredNids = uiNamespace.findMatchingItems(
            uiNamespace.checkedTermIds
        );
        //Remove from the list of filtered (matching) items those
        //items that already have been linked to the exercise.
        uiNamespace.filteredNids = uiNamespace.removeAlreadyLinkedItems( 
            uiNamespace.filteredNids, uiNamespace.linkedItems
        );
        //If user has already selected an item, make sure it is in 
        //the filtered items list. So that selected item doesn't vanish
        //from the display as the user unchecks terms.
        if ( uiNamespace.selectedItemNid ) {
          uiNamespace.filteredNids = uiNamespace.includeSelectedItem(
              uiNamespace.filteredNids, uiNamespace.selectedItemNid
          );
        } //End there is a selected item.
        //Update the filtered item display.
        uiNamespace.updateFilteredItemDisplay();
//      }
//      catch (e) {
//        var message = "Error! " + e.message 
//            + "\nFile: " + e.fileName + "\nLine: " + e.lineNumber
//            + "\n\nPlease take a screen shot, and send it to the CyCo people.";
//        console.log( message );
//        alert( message );
//      }
//      finally {
        document.body.style.cursor = 'default';
//      }
    },
    /*
     * Return a list of tids (term ids) of terms the user has checked. 
     */
    findCheckedTerms: function() {
      var selNodes = uiNamespace.tree.fancytree("getTree").getSelectedNodes();
      //Replace existing array of checked term ids.
      var terms = new Array();
      $(selNodes).each( function(index, node) {
        terms.push( node.key );
//        console.log( node.key + " " + node.title );
      });
      return terms;
    },
    /*
     * Return the items that have a term in the given list of terms.
     */
    findMatchingItems: function( terms ) {
      var matchingItems = new Array();
      var itemCategories; //Categories (tids) for an item.
      var itemCategory; //A particular category, member of itemCategories.
      var itemMatched; //True if the item should be added to the filtered list.
      $(uiNamespace.rubricsServerData).each(function(index, rubricItem){
//          console.log(rubricItem);
        if ( rubricItem.categories ) {
          //There are categories for the current item.
          itemMatched = false;
          itemCategories = rubricItem.categories;
          //Loop over categories of current item, and see if one is checked.
          for ( var i = 0; i < itemCategories.length; i++ ) {
            itemCategory = itemCategories[i];
            if ( terms.indexOf( itemCategory ) != -1 ) {
              //Found it. Add this item to the filtered list.
              itemMatched = true;
              break;
            }
          }
          if ( itemMatched ) {
//              console.log("match");
            matchingItems.push( rubricItem.nid );
          }
        } //End there are categories for current item.
      });
      return matchingItems;
    },
    /*
     * Remove items already linked to exercise from a list of items.
     * @param Array matchingItemsList Items with checked terms.
     * @param Array alreadyLinkedList Items already linked to the exercise.
     * @returns Array Matching items list with already linked ones removed.
     */
    removeAlreadyLinkedItems: function( matchingItemsList, alreadyLinkedList ) {
      //See http://stackoverflow.com/questions/10927722/jquery-compare-2-arrays-return-difference
      var diff = $(matchingItemsList).not(alreadyLinkedList).get();
      return diff;
    },
    /*
     * If the item selected by the user is not already in the list of filtered 
     * items, add it. Stops the selected item from vanishing from the 
     * display as the user unchecks terms.
     * @param Array filteredItems Items filtered for display.
     * @param int selectedItem Item user has selected.
     * @returns Array New list of items filtered for display.
     */
    includeSelectedItem: function( filteredItems, selectedItem ) {
      //Check whether the item is already in the list.
      if ( filteredItems.indexOf( selectedItem ) == -1 ) {
        filteredItems.push( selectedItem );
      }
      return filteredItems;
    },
    /*
     * Update the display of filtered items, based on the checked terms.
     */
    updateFilteredItemDisplay: function() {
      var fi = $("#filtered-terms");
      //Erase existing displayed items.
      $("#filtered-terms li").remove(); 
      //Loop over the filtered items.
      var nid, rubricItem, extraAttributes, i;
      for (i = 0; i < uiNamespace.filteredNids.length; i++) {
        nid = uiNamespace.filteredNids[i];
        //Get the rubric item for this nid.
        rubricItem = uiNamespace.findRubricItem( nid );
        //Is it the selected one? If so, add a class.
        extraAttributes = ( nid == uiNamespace.selectedItemNid ) 
            ? " class='" + uiNamespace.selectedItemClass + "' " : "";
        //Show the item.
        fi.append("<li data-nid='" + nid + "' " + extraAttributes + " >" 
            + rubricItem.title + "</li>");
      } //End loop over filtered items.      
    },
    /*
     * The user clicked on a rubric item.
     * @param Object event The click event's details.
     */
    rubricItemSelected: function( event ) {
      var clickedItem = event.target;
      var clickedNid = parseInt( $(clickedItem).attr("data-nid") );
      //Remove existing highlight.
      $("." + uiNamespace.selectedItemClass )
        .removeClass(uiNamespace.selectedItemClass)
      //Save nid of selected item.
      uiNamespace.selectedItemNid = clickedNid;
      //Add highlight class.
      $(clickedItem).addClass(uiNamespace.selectedItemClass);
      //Enable buttons.
      $("#rubric-select-edit").removeAttr("disabled");
      $("#rubric-select-link").removeAttr("disabled");
    },
    /**
     * Find data from server for a rubric item with a gives nid. 
     * @param {integer} nidToFind
     * @returns The rubric item's data, or null if not found.
     */
    findRubricItem: function( nidToFind ) {
      var rubricItem;
      var nid;
      for (var i = 0; i < uiNamespace.rubricsServerData.length; i++) {
        rubricItem = uiNamespace.rubricsServerData[i];
        nid = rubricItem.nid;
        if ( nid == nidToFind ) {
          return rubricItem;
        }
      }
      return null;
    },
    showAjaxThrobber: function() {
      $("#rubric-select-loading-throbber").show("fast");
    },
    hideAjaxThrobber: function() {
      $("#rubric-select-loading-throbber").hide("fast");
    }
  };
}(jQuery));
