package model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MovieDTO {
	private String movieCd;
	private String movieNm;
	private String prdtYear;
	private String typeNm;
	private String nationAlt;
	private String genreAlt;
	private String posterUrl;//KMDB되면
}