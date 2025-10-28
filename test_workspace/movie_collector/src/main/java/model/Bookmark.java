package model;

import java.util.ArrayList;

import lombok.Data;

@Data
public class Bookmark {
	private String member_seq;
	private int bookmark_seq;
	private String bookmark_name;
	private ArrayList<String> bookmark_list;
}